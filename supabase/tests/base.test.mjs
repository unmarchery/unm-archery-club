// Runs the migrations in PGlite (Postgres in WebAssembly) and checks the booking rules.
// Run with: npm run test:db
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const here = new URL('.', import.meta.url)
let db

async function one(sql, params = []) {
  const res = await db.query(sql, params)
  return res.rows[0]
}

// Runs a query as a signed-in user through the `authenticated` role, like the website does.
async function asUser(uid, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  await db.exec('set role authenticated')
  try {
    return (await db.query(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

async function rejects(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.match(err.message, new RegExp(code))
    return true
  })
}

async function signUp(studentId, email, name = 'Test Archer') {
  const row = await one(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ student_id: studentId, full_name: name, phone: '0123456789' })],
  )
  return row.id
}

// Three slots on one day that is always inside the booking window, plus helpers.
async function testDay() {
  const { day } = await one(
    `select ((bookable_until at time zone 'Asia/Kuala_Lumpur')::date - 2) as day from booking_window()`,
  )
  const ids = []
  for (const hour of ['16:00', '17:00', '18:00']) {
    const row = await one(
      `insert into slots (starts_at, ends_at)
       values (($1::date + $2::time) at time zone 'Asia/Kuala_Lumpur',
               ($1::date + $2::time + interval '1 hour') at time zone 'Asia/Kuala_Lumpur')
       on conflict (starts_at) do update set cancelled_at = null
       returning id`,
      [day, hour],
    )
    ids.push(row.id)
  }
  return ids
}

before(async () => {
  db = new PGlite()
  await db.exec(await readFile(new URL('supabase-stubs.sql', here), 'utf8'))
  const dir = new URL('../migrations/', here)
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, dir), 'utf8'))
  }
})

test('signup creates a profile and rejects bad input', async () => {
  const uid = await signUp('20512034', 'Abcde1@nottingham.edu.my', 'Alex Tan')
  const prof = await one('select * from profiles where id = $1', [uid])
  assert.equal(prof.student_id, '20512034')
  assert.equal(prof.email, 'abcde1@nottingham.edu.my')

  await rejects(signUp('2051203', 'x@nottingham.edu.my'), 'INVALID_STUDENT_ID')
  await rejects(signUp('20512035', 'x@gmail.com'), 'INVALID_EMAIL_DOMAIN')
  await rejects(signUp('20512034', 'other@nottingham.edu.my'), 'duplicate key')

  const plain = await one(`insert into auth.users (email) values ('admin@example.com') returning id`)
  assert.equal((await one('select count(*)::int as n from profiles where id = $1', [plain.id])).n, 0)
})

test('membership needs the form row; email match makes it automatic', async () => {
  const a = await signUp('20000001', 'mema1@nottingham.edu.my')
  const b = await signUp('20000002', 'memb1@nottingham.edu.my')
  const c = await signUp('20000003', 'memc1@nottingham.edu.my')
  await db.query(`insert into members (student_id, email) values ('20000001', 'mema1@nottingham.edu.my'), ('20000002', 'someone@gmail.com')`)
  assert.equal((await one('select membership_status($1) as s', [a])).s, 'member')
  assert.equal((await one('select membership_status($1) as s', [b])).s, 'pending')
  assert.equal((await one('select membership_status($1) as s', [c])).s, 'none')
  await db.query('update profiles set member_override = true where id = $1', [b])
  assert.equal((await one('select membership_status($1) as s', [b])).s, 'member')
  await db.query(`update settings set membership_valid_until = current_date - 1`)
  assert.equal((await one('select membership_status($1) as s', [a])).s, 'none')
  await db.query(`update settings set membership_valid_until = null`)
})

test('ensure_slots builds this week and next week once', async () => {
  const before = (await one('select count(*)::int as n from slots')).n
  await db.query('select ensure_slots()')
  const after = (await one('select count(*)::int as n from slots')).n
  assert.equal(after - before, 12) // Tue and Thu, 3 slots each, 2 weeks
  await db.query('select ensure_slots()')
  assert.equal((await one('select count(*)::int as n from slots')).n, after)
  const hours = await db.query(
    `select distinct to_char(starts_at at time zone 'Asia/Kuala_Lumpur', 'ID HH24:MI') as t from slots order by 1`,
  )
  assert.deepEqual(hours.rows.map((r) => r.t), ['2 16:00', '2 17:00', '2 18:00', '4 16:00', '4 17:00', '4 18:00'])
})

test('members book free; full slots and duplicates are refused', async () => {
  await db.query('delete from slots')
  const [s1] = await testDay()
  const member = await signUp('20000010', 'mem10@nottingham.edu.my')
  await db.query(`insert into members (student_id, email) values ('20000010', 'mem10@nottingham.edu.my')`)

  const [{ book_slot: bookingId }] = await asUser(member, 'select book_slot($1)', [s1])
  assert.ok(bookingId)
  await rejects(asUser(member, 'select book_slot($1)', [s1]), 'ALREADY_BOOKED')

  await db.query('update settings set capacity = 1')
  const member2 = await signUp('20000011', 'mem11@nottingham.edu.my')
  await db.query(`insert into members (student_id, email) values ('20000011', 'mem11@nottingham.edu.my')`)
  await rejects(asUser(member2, 'select book_slot($1)', [s1]), 'SLOT_FULL')
  await db.query('update settings set capacity = 20')
})

test('non-members need passes and are capped at 25% of a slot', async () => {
  await db.query('delete from slots')
  const [s1, s2] = await testDay()
  const exco = await signUp('20000020', 'exco20@nottingham.edu.my')
  const guest = await signUp('20000021', 'guest21@nottingham.edu.my')
  const guest2 = await signUp('20000022', 'guest22@nottingham.edu.my')

  await rejects(asUser(guest, `select book_slot($1, 'single')`, [s1]), 'NO_PASSES')
  await rejects(asUser(guest, `select book_slot($1)`, [s1]), 'PASS_REQUIRED')
  await rejects(asUser(guest, `select adjust_passes('20000021', 'single', 3, 'self')`), 'NOT_ALLOWED')

  await db.query(`insert into permissions (user_id, permission) values ($1, 'owner')`, [exco])
  const [{ adjust_passes: bal }] = await asUser(exco, `select adjust_passes('20000021', 'single', 3, 'cash test')`)
  assert.equal(bal, 3)
  await asUser(exco, `select adjust_passes('20000022', 'single', 1, 'cash test')`)

  await asUser(guest, `select book_slot($1, 'single')`, [s1])
  assert.equal((await one(`select pass_balance($1, 'single') as n`, [guest])).n, 2)

  await db.query('update settings set capacity = 4') // non-member cap = 1
  await rejects(asUser(guest2, `select book_slot($1, 'single')`, [s1]), 'NONMEMBER_FULL')
  await asUser(guest2, `select book_slot($1, 'single')`, [s2])
  await db.query('update settings set capacity = 20')

  const [status] = await asUser(guest, 'select my_status() as s')
  assert.equal(status.s.membership, 'none')
  assert.equal(status.s.single, 2)
})

test('full-day pass books all three slots; only a whole-day cancel refunds it', async () => {
  await db.query('delete from slots')
  const [s1, s2, s3] = await testDay()
  const exco = (await one(`select user_id from permissions where permission = 'owner'`)).user_id
  const guest = await signUp('20000030', 'guest30@nottingham.edu.my')
  await asUser(exco, `select adjust_passes('20000030', 'full', 2, 'test')`)

  const [{ book_slot: first }] = await asUser(guest, `select book_slot($1, 'full')`, [s2])
  const mine = await db.query(`select slot_id, full_day_group from bookings where user_id = $1 and status = 'booked'`, [guest])
  assert.equal(mine.rows.length, 3)
  assert.deepEqual(new Set(mine.rows.map((r) => r.slot_id)), new Set([s1, s2, s3]))
  assert.equal(new Set(mine.rows.map((r) => r.full_day_group)).size, 1)
  assert.equal((await one(`select pass_balance($1, 'full') as n`, [guest])).n, 1)

  const [{ cancel_booking: partial }] = await asUser(guest, 'select cancel_booking($1, false)', [first])
  assert.equal(partial.refunded, false)
  const remaining = (await one(`select id from bookings where user_id = $1 and status = 'booked' limit 1`, [guest])).id
  const [{ cancel_booking: whole }] = await asUser(guest, 'select cancel_booking($1, true)', [remaining])
  assert.equal(whole.refunded, true)
  assert.equal((await one(`select count(*)::int as n from bookings where user_id = $1 and status = 'booked'`, [guest])).n, 0)
  assert.equal((await one(`select pass_balance($1, 'full') as n`, [guest])).n, 2)
})

test('single pass comes back only when cancelled 2 hours or more before', async () => {
  await db.query('delete from slots')
  const [s1] = await testDay()
  const soon = (await one(
    `insert into slots (starts_at, ends_at) values (date_trunc('minute', now()) + interval '61 minutes', date_trunc('minute', now()) + interval '121 minutes') returning id`,
  )).id
  const exco = (await one(`select user_id from permissions where permission = 'owner'`)).user_id
  const guest = await signUp('20000040', 'guest40@nottingham.edu.my')
  await asUser(exco, `select adjust_passes('20000040', 'single', 2, 'test')`)

  const [{ book_slot: early }] = await asUser(guest, `select book_slot($1, 'single')`, [s1])
  const [{ book_slot: late }] = await asUser(guest, `select book_slot($1, 'single')`, [soon])
  assert.equal((await one(`select pass_balance($1, 'single') as n`, [guest])).n, 0)

  const [{ cancel_booking: r1 }] = await asUser(guest, 'select cancel_booking($1)', [early])
  const [{ cancel_booking: r2 }] = await asUser(guest, 'select cancel_booking($1)', [late])
  assert.equal(r1.refunded, true)
  assert.equal(r2.refunded, false)
  assert.equal((await one(`select pass_balance($1, 'single') as n`, [guest])).n, 1)
})

test('slots beyond the booking window are not open yet', async () => {
  const far = (await one(
    `insert into slots (starts_at, ends_at)
     select bookable_until + interval '1 day', bookable_until + interval '25 hours' from booking_window() returning id`,
  )).id
  const member = (await one(`select id from profiles where student_id = '20000010'`)).id
  await rejects(asUser(member, 'select book_slot($1)', [far]), 'NOT_OPEN_YET')
})

test('row level security keeps each archer to their own data', async () => {
  const a = (await one(`select id from profiles where student_id = '20000021'`)).id
  const b = (await one(`select id from profiles where student_id = '20000022'`)).id

  const profiles = await asUser(a, 'select id from profiles')
  assert.deepEqual(profiles.map((r) => r.id), [a])
  const bookings = await asUser(a, 'select user_id from bookings')
  assert.ok(bookings.every((r) => r.user_id === a))
  const passes = await asUser(b, 'select user_id from pass_ledger')
  assert.ok(passes.length > 0 && passes.every((r) => r.user_id === b))

  await rejects(asUser(a, 'select * from members'), 'permission denied')
  await rejects(asUser(a, `insert into bookings (slot_id, user_id, pass_kind, is_member) select id, $1, 'member', true from slots limit 1`, [a]), 'permission denied')
  await rejects(asUser(a, `insert into pass_ledger (user_id, kind, delta, reason) values ($1, 'single', 10, 'adjust')`, [a]), 'permission denied')
  await rejects(asUser(a, `update profiles set member_override = true where id = $1`, [a]), 'permission denied')
  await asUser(a, `update settings set capacity = 99`) // no edit_settings permission: no rows change
  assert.equal((await one('select capacity from settings')).capacity, 20)

  const avail = await asUser(a, `select * from slot_availability(now() - interval '1 day', now() + interval '30 days')`)
  assert.ok(avail.length > 0)
  assert.ok(!('user_id' in avail[0]))
})

const ownerId = async () => (await one(`select user_id from permissions where permission = 'owner'`)).user_id

test('non-members can request a member check, one at a time', async () => {
  const uid = await signUp('20000050', 'req50@nottingham.edu.my', 'Request Tester')
  const [{ request_member_check: id }] = await asUser(uid, `select request_member_check('Used my gmail on the form')`)
  assert.ok(id)
  await rejects(asUser(uid, 'select request_member_check(null)'), 'REQUEST_PENDING')
  const [status] = await asUser(uid, 'select my_status() as s')
  assert.equal(status.s.request.status, 'pending')

  const member = (await one(`select id from profiles where student_id = '20000010'`)).id
  await rejects(asUser(member, 'select request_member_check(null)'), 'ALREADY_MEMBER')
})

test('only member managers review requests; approving makes a member', async () => {
  const exco = await ownerId()
  const requester = (await one(`select id from profiles where student_id = '20000050'`)).id
  const guest = (await one(`select id from profiles where student_id = '20000021'`)).id

  await rejects(asUser(guest, 'select * from member_requests_for_review()'), 'NOT_ALLOWED')
  assert.equal((await asUser(guest, 'select * from member_requests')).length, 0)

  const rows = await asUser(exco, 'select * from member_requests_for_review()')
  const row = rows.find((r) => r.student_id === '20000050')
  assert.equal(row.on_form, false)
  assert.equal(row.note, 'Used my gmail on the form')
  const [badge] = await asUser(exco, 'select my_status() as s')
  assert.ok(badge.s.pending_member_requests >= 1)
  assert.ok(badge.s.perms.includes('owner'))

  await rejects(asUser(guest, 'select decide_member_request($1, true)', [row.request_id]), 'NOT_ALLOWED')
  await asUser(exco, 'select decide_member_request($1, true)', [row.request_id])
  assert.equal((await one('select membership_status($1) as s', [requester])).s, 'member')
  assert.equal((await one(`select count(*)::int as n from members where student_id = '20000050'`)).n, 1)
  await rejects(asUser(exco, 'select decide_member_request($1, true)', [row.request_id]), 'REQUEST_NOT_FOUND')
})

test('a rejected request shows the reason and can be sent again', async () => {
  const exco = await ownerId()
  const uid = await signUp('20000051', 'req51@nottingham.edu.my')
  const [{ request_member_check: id }] = await asUser(uid, 'select request_member_check(null)')
  await asUser(exco, `select decide_member_request($1, false, 'Not on our list yet')`, [id])

  const [status] = await asUser(uid, 'select my_status() as s')
  assert.equal(status.s.request.status, 'rejected')
  assert.equal(status.s.request.reason, 'Not on our list yet')
  assert.equal(status.s.membership, 'none')
  await asUser(uid, 'select request_member_check(null)')
})

test('nobody decides their own member check', async () => {
  const exco = await ownerId()
  const [{ request_member_check: id }] = await asUser(exco, 'select request_member_check(null)')
  await rejects(asUser(exco, 'select decide_member_request($1, true)', [id]), 'OWN_REQUEST')
})

test('starter accounts must change their password; overview lists who can get one', async () => {
  const exco = await ownerId()
  const row = await one(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    ['star60@nottingham.edu.my', JSON.stringify({ student_id: '20000060', full_name: 'Star Sixty', must_change_password: true })],
  )
  assert.equal((await one('select must_change_password as m from profiles where id = $1', [row.id])).m, true)
  await asUser(row.id, 'select password_changed()')
  assert.equal((await one('select must_change_password as m from profiles where id = $1', [row.id])).m, false)

  await db.query(`insert into members (student_id, full_name, email) values
    ('20000061', 'Ready Archer', 'ready61@nottingham.edu.my'),
    ('20000062', 'Gmail Archer', 'gmail62@gmail.com')`)
  const guest = (await one(`select id from profiles where student_id = '20000021'`)).id
  await rejects(asUser(guest, 'select member_account_overview()'), 'NOT_ALLOWED')

  const [{ member_account_overview: o }] = await asUser(exco, 'select member_account_overview()')
  assert.ok(o.ready.some((m) => m.student_id === '20000061'))
  assert.ok(o.blocked.some((m) => m.student_id === '20000062'))
  assert.ok(!o.ready.some((m) => m.student_id === '20000010')) // already has an account
  assert.ok(o.with_account >= 1 && o.total >= o.with_account)
})
