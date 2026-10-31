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

// The website's server uses the secret key (service_role) to find a student's email at
// login and to save the member list. Newer Supabase projects grant it nothing by default.
test('the server can find accounts at login and save the member list', async () => {
  await signUp('20000070', 'server70@nottingham.edu.my')
  await db.exec('set role service_role')
  try {
    const found = (await db.query(`select email from profiles where student_id = '20000070'`)).rows
    assert.equal(found[0]?.email, 'server70@nottingham.edu.my')
    await db.query('select starter_password_days from settings where id = 1')
    await db.query(`insert into members (student_id, full_name, email) values ('20000071', 'Form Row', 'row71@nottingham.edu.my')
      on conflict (student_id) do update set full_name = excluded.full_name`)
  } finally {
    await db.exec('reset role')
  }
})

test('non-members request top-ups; QR needs a receipt and a bank reference used once', async () => {
  const uid = await signUp('20000080', 'top80@nottingham.edu.my', 'Topup Archer')
  const other = await signUp('20000081', 'top81@nottingham.edu.my', 'Other Archer')
  const receipt = `${uid}/r1.jpg`

  const [{ t }] = await asUser(uid, `select request_topup(2, 1, 'qr', ' ab 12 34 ', $1) as t`, [receipt])
  assert.equal(t.amount, 2 * 5 + 12)
  const row = await one('select * from topups where id = $1', [t.id])
  assert.equal(row.bank_ref, 'AB1234')
  assert.equal(row.status, 'pending')

  await rejects(asUser(uid, `select request_topup(1, 0, 'qr', null, $1)`, [receipt]), 'BANK_REF_REQUIRED')
  await rejects(asUser(uid, `select request_topup(1, 0, 'qr', 'XY9999', null)`), 'RECEIPT_REQUIRED')
  await rejects(asUser(uid, `select request_topup(1, 0, 'qr', 'XY9999', $1)`, [`${other}/stolen.jpg`]), 'RECEIPT_REQUIRED')
  await rejects(asUser(uid, `select request_topup(0, 0, 'cash')`), 'INVALID_QUANTITY')
  await rejects(asUser(uid, `select request_topup(21, 0, 'cash')`), 'INVALID_QUANTITY')
  await rejects(asUser(other, `select request_topup(1, 0, 'qr', 'AB1234', $1)`, [`${other}/r.jpg`]), 'BANK_REF_USED')

  await asUser(uid, `select request_topup(1, 0, 'cash')`)
  await asUser(uid, `select request_topup(0, 1, 'cash')`)
  await rejects(asUser(uid, `select request_topup(1, 0, 'cash')`), 'TOO_MANY_PENDING')

  const member = await signUp('20000082', 'top82@nottingham.edu.my', 'Member Archer')
  await db.query(`insert into members (student_id, email) values ('20000082', 'top82@nottingham.edu.my')`)
  await rejects(asUser(member, `select request_topup(1, 0, 'cash')`), 'MEMBERS_FREE')

  // Each archer sees only their own top-ups.
  assert.equal((await asUser(uid, 'select count(*)::int as n from topups'))[0].n, 3)
  assert.equal((await asUser(other, 'select count(*)::int as n from topups'))[0].n, 0)

  const cash = (await one(`select id from topups where user_id = $1 and full_qty = 1 and method = 'cash'`, [uid])).id
  await rejects(asUser(other, 'select cancel_topup($1)', [cash]), 'TOPUP_NOT_FOUND')
  await asUser(uid, 'select cancel_topup($1)', [cash])
  assert.equal((await one('select status from topups where id = $1', [cash])).status, 'cancelled')
})

test('only approvers decide top-ups; approving credits the passes', async () => {
  const exco = await ownerId()
  const uid = (await one(`select id from profiles where student_id = '20000080'`)).id
  const other = (await one(`select id from profiles where student_id = '20000081'`)).id
  const qr = (await one(`select id from topups where user_id = $1 and method = 'qr'`, [uid])).id
  const cash = (await one(`select id from topups where user_id = $1 and method = 'cash' and status = 'pending'`, [uid])).id

  await rejects(asUser(other, 'select topups_for_review()'), 'NOT_ALLOWED')
  await rejects(asUser(other, 'select decide_topup($1, true)', [qr]), 'NOT_ALLOWED')

  const [{ topups_for_review: queue }] = await asUser(exco, 'select topups_for_review()')
  assert.equal(queue.pending.find((t) => t.id === qr).full_name, 'Topup Archer')
  const [{ s }] = await asUser(exco, 'select my_status() as s')
  assert.ok(s.pending_topups >= 2)

  await rejects(asUser(exco, 'select decide_topup($1, false, $2)', [cash, '  ']), 'REASON_REQUIRED')
  await asUser(exco, 'select decide_topup($1, false, $2)', [cash, 'No cash received'])
  await asUser(exco, 'select decide_topup($1, true)', [qr])
  await rejects(asUser(exco, 'select decide_topup($1, true)', [qr]), 'TOPUP_NOT_FOUND')

  assert.equal((await one(`select pass_balance($1, 'single') as n`, [uid])).n, 2)
  assert.equal((await one(`select pass_balance($1, 'full') as n`, [uid])).n, 1)
  const decided = await one('select status, decided_by from topups where id = $1', [qr])
  assert.equal(decided.status, 'approved')
  assert.equal(decided.decided_by, exco)
  const [mine] = await asUser(uid, 'select reason from topups where id = $1', [cash])
  assert.equal(mine.reason, 'No cash received')

  // A rejected bank reference can be sent again; an approver can't approve their own.
  await db.query(`insert into permissions (user_id, permission) values ($1, 'approve_topups')`, [other])
  const [{ t }] = await asUser(other, `select request_topup(1, 0, 'cash') as t`)
  await rejects(asUser(other, 'select decide_topup($1, true)', [t.id]), 'OWN_REQUEST')
  await db.query(`delete from permissions where user_id = $1`, [other])
})

test('finance report totals approved top-ups and passes still owed', async () => {
  const exco = await ownerId()
  const guest = (await one(`select id from profiles where student_id = '20000081'`)).id
  await rejects(asUser(guest, `select finance_report(current_date - 30, current_date)`), 'NOT_ALLOWED')

  const [{ finance_report: r }] = await asUser(exco, `select finance_report(current_date - 30, current_date)`)
  const row = r.rows.find((x) => x.student_id === '20000080')
  assert.equal(row.amount, 22)
  assert.equal(row.method, 'qr')
  assert.ok(row.approved_by)
  assert.ok(r.total >= 22 && r.qr_total >= 22)
  const owed = await one(`select coalesce(sum(delta) filter (where kind = 'single'), 0)::int as s,
                                 coalesce(sum(delta) filter (where kind = 'full'), 0)::int as f from pass_ledger`)
  assert.equal(r.unused_single, owed.s)
  assert.equal(r.unused_value, owed.s * 5 + owed.f * 12)

  const [{ finance_report: none }] = await asUser(exco, `select finance_report(current_date + 1, current_date + 2)`)
  assert.equal(none.count, 0)
})

test('payment settings: approvers set the QR and a WhatsApp link', async () => {
  const exco = await ownerId()
  const guest = (await one(`select id from profiles where student_id = '20000081'`)).id
  await rejects(asUser(guest, `select save_payment_settings('club/qr.jpg', null)`), 'NOT_ALLOWED')
  await rejects(asUser(exco, `select save_payment_settings(null, 'https://evil.example.com/x')`), 'INVALID_LINK')
  await rejects(asUser(exco, `select save_payment_settings('someone/qr.jpg', null)`), 'INVALID_PATH')
  await asUser(exco, `select save_payment_settings('club/qr-1.jpg', 'https://chat.whatsapp.com/AbC123')`)
  await asUser(exco, `select save_payment_settings(null, 'https://chat.whatsapp.com/AbC123')`)
  const s = await one('select payment_qr_path, payment_whatsapp_link from settings')
  assert.equal(s.payment_qr_path, 'club/qr-1.jpg')
  assert.equal(s.payment_whatsapp_link, 'https://chat.whatsapp.com/AbC123')
})

test('receipts are deleted only when the Treasurer and the President or VP agree', async () => {
  const pres = await ownerId()
  const vp = await signUp('20000090', 'vp90@nottingham.edu.my', 'Vice Person')
  const tre = await signUp('20000091', 'tre91@nottingham.edu.my', 'Treasurer Person')
  const sec = await signUp('20000092', 'sec92@nottingham.edu.my', 'Secretary Person')
  for (const [id, pos] of [[pres, 'President'], [vp, 'Vice President'], [tre, 'Treasurer'], [sec, 'Secretary']]) {
    await db.query('update profiles set position = $2 where id = $1', [id, pos])
  }
  await rejects(db.query(`update profiles set position = 'Treasurer' where id = $1`, [sec]), 'duplicate key')

  const archer = (await one(`select id from profiles where student_id = '20000080'`)).id
  const qr = (await one(`select id from topups where user_id = $1 and method = 'qr' and status = 'approved'`, [archer])).id
  await rejects(asUser(sec, 'select request_receipt_deletion($1, $2)', [qr, 'Please remove']), 'NOT_ALLOWED')
  await rejects(asUser(pres, 'select request_receipt_deletion($1, $2)', [qr, '  ']), 'REASON_REQUIRED')
  const [{ request_receipt_deletion: req }] = await asUser(pres, 'select request_receipt_deletion($1, $2)', [qr, 'The archer asked us to remove it'])
  await rejects(asUser(vp, 'select request_receipt_deletion($1, $2)', [qr, 'Again']), 'DELETE_PENDING')
  await rejects(asUser(pres, 'select decide_receipt_deletion($1, true)', [req]), 'OWN_REQUEST')
  await rejects(asUser(vp, 'select decide_receipt_deletion($1, true)', [req]), 'TREASURER_AND_PRESIDENT')
  await rejects(asUser(sec, 'select decide_receipt_deletion($1, true)', [req]), 'NOT_ALLOWED')

  const [{ receipt_deletions_open: forTre }] = await asUser(tre, 'select receipt_deletions_open()')
  assert.equal(forTre.find((r) => r.id === req).can_agree, true)
  assert.equal(forTre.find((r) => r.id === req).requested_by, 'Test Archer (President)')
  const [{ receipt_deletions_open: forSec }] = await asUser(sec, 'select receipt_deletions_open()')
  assert.equal(forSec.length, 0)

  const [{ decide_receipt_deletion: path }] = await asUser(tre, 'select decide_receipt_deletion($1, true)', [req])
  assert.equal(path, `${archer}/r1.jpg`)
  const t = await one('select receipt_path, receipt_deleted_at from topups where id = $1', [qr])
  assert.equal(t.receipt_path, null)
  assert.ok(t.receipt_deleted_at)
  const [{ finance_report: r }] = await asUser(pres, 'select finance_report(current_date - 30, current_date)')
  const row = r.rows.find((x) => x.id === qr)
  assert.equal(row.receipt_deleted, true)
  assert.match(row.approved_by, /\(President\)$/)
  await rejects(asUser(vp, 'select request_receipt_deletion($1, $2)', [qr, 'Again']), 'RECEIPT_NOT_FOUND')

  // A request lapses after 14 days; then a new one can be made, and declined.
  const guest = (await one(`select id from profiles where student_id = '20000081'`)).id
  const [{ t: second }] = await asUser(guest, `select request_topup(1, 0, 'qr', 'ZZ7788', $1) as t`, [`${guest}/r2.jpg`])
  await rejects(asUser(tre, 'select request_receipt_deletion($1, $2)', [second.id, 'Too early']), 'TOPUP_PENDING')
  await asUser(pres, 'select decide_topup($1, false, $2)', [second.id, 'No payment found'])
  const [{ request_receipt_deletion: old }] = await asUser(tre, 'select request_receipt_deletion($1, $2)', [second.id, 'Rejected anyway'])
  await db.query(`update receipt_deletions set created_at = now() - interval '15 days' where id = $1`, [old])
  await rejects(asUser(vp, 'select decide_receipt_deletion($1, true)', [old]), 'REQUEST_EXPIRED')
  const [{ request_receipt_deletion: fresh }] = await asUser(tre, 'select request_receipt_deletion($1, $2)', [second.id, 'Rejected anyway'])
  assert.equal((await one('select status from receipt_deletions where id = $1', [old])).status, 'expired')
  await asUser(vp, 'select decide_receipt_deletion($1, false)', [fresh])
  assert.equal((await one('select status from receipt_deletions where id = $1', [fresh])).status, 'declined')
  assert.ok((await one('select receipt_path from topups where id = $1', [second.id])).receipt_path)
})

test('top-up alert emails go to approvers, and only the server can list them', async () => {
  await rejects(asUser(await ownerId(), 'select * from topup_alert_emails(null)'), 'permission denied')
  const ownerEmail = (await one(`select p.email from permissions x join profiles p on p.id = x.user_id where x.permission = 'owner'`)).email
  await db.exec('set role service_role')
  try {
    const rows = (await db.query('select email from topup_alert_emails(null)')).rows.map((r) => r.email)
    assert.ok(rows.includes(ownerEmail))
    assert.ok(!rows.includes('top81@nottingham.edu.my'))
  } finally {
    await db.exec('reset role')
  }
})

test('exco page shows a WhatsApp number only when its owner switches it on', async () => {
  const sec = (await one(`select id from profiles where student_id = '20000092'`)).id
  const archer = (await one(`select id from profiles where student_id = '20000081'`)).id
  await rejects(asUser(archer, `select save_my_card('0123456789', true)`), 'NOT_ALLOWED')
  await rejects(asUser(sec, `select save_my_card(null, true)`), 'INVALID_PHONE')
  await rejects(asUser(sec, `select save_my_card('12ab', false)`), 'INVALID_PHONE')

  await asUser(sec, `select save_my_card('012-345 6789', false)`)
  assert.equal((await one('select whatsapp from profiles where id = $1', [sec])).whatsapp, '60123456789')
  let [{ exco_directory: list }] = await asUser(archer, 'select exco_directory()')
  const card = () => list.find((p) => p.id === sec)
  assert.equal(card().position, 'Secretary')
  assert.equal(card().whatsapp, null)
  await asUser(sec, `select save_my_card('0123456789', true)`)
  ;[{ exco_directory: list }] = await asUser(archer, 'select exco_directory()')
  assert.equal(card().whatsapp, '60123456789')
  assert.ok(!list.some((p) => p.id === archer))
  assert.equal(list[0].position, 'President')
})

test('the President and VP switch access from the website, within limits, and it is logged', async () => {
  const pres = await ownerId()
  const vp = (await one(`select id from profiles where student_id = '20000090'`)).id
  const tre = (await one(`select id from profiles where student_id = '20000091'`)).id
  const sec = (await one(`select id from profiles where student_id = '20000092'`)).id
  const archer = (await one(`select id from profiles where student_id = '20000081'`)).id

  await rejects(asUser(sec, `select set_permission($1, 'approve_topups', true)`, [archer]), 'NOT_ALLOWED')
  await rejects(asUser(pres, `select set_permission($1, 'owner', true)`, [vp]), 'OWNER_LOCKED')
  await rejects(asUser(pres, `select set_permission($1, 'approve_topups', true, current_date - 1)`, [tre]), 'DATE_IN_PAST')
  await asUser(pres, `select set_permission($1, 'approve_topups', true, current_date + 30)`, [tre])
  await asUser(pres, `select set_permission($1, 'manage_members', true)`, [vp])
  assert.ok((await one(`select expires_at from permissions where user_id = $1 and permission = 'approve_topups'`, [tre])).expires_at)

  // The VP can switch only what they hold.
  await asUser(vp, `select set_permission($1, 'manage_members', true)`, [sec])
  await rejects(asUser(vp, `select set_permission($1, 'export_finance', true)`, [sec]), 'CANT_GIVE_MORE')
  await rejects(asUser(vp, 'select remove_from_exco($1)', [pres]), 'OWNER_LOCKED')
  await rejects(asUser(vp, 'select remove_from_exco($1)', [tre]), 'OFFICER_POSITION')

  // Positions: officers only by the President; others by change_positions.
  await asUser(pres, `select set_permission($1, 'change_positions', true)`, [vp])
  await rejects(asUser(vp, `select set_position('20000081', 'Treasurer', null)`), 'OFFICER_POSITION')
  await asUser(vp, `select set_position('20000081', 'Events Dept', 'Helps with competitions')`)
  assert.equal((await one('select position, handles from profiles where id = $1', [archer])).handles, 'Helps with competitions')
  await rejects(asUser(pres, `select set_position('20000081', 'Treasurer', null)`), 'POSITION_TAKEN')
  await rejects(asUser(pres, `select set_position('20000081', 'Captain', null)`), 'INVALID_POSITION')
  await rejects(asUser(pres, `select set_position('29999999', 'Events', null)`), 'STUDENT_NOT_FOUND')

  const [{ people_overview: view }] = await asUser(vp, 'select people_overview()')
  assert.equal(view.can_access, true)
  assert.ok(view.people.some((p) => p.id === archer && p.position === 'Events Dept'))
  assert.ok(view.log.some((l) => l.action.startsWith('gave Approve top-ups until')))
  const [{ people_overview: forArcher }] = await asUser(archer, 'select people_overview()')
  assert.equal(forArcher.can_access, false)
  assert.deepEqual(forArcher.log, [])
  const outsider = (await one(`select id from profiles where student_id = '20000082'`)).id
  assert.equal((await asUser(outsider, 'select people_overview() as v'))[0].v, null)

  await asUser(vp, 'select remove_from_exco($1)', [archer])
  assert.equal((await one('select position from profiles where id = $1', [archer])).position, null)
  await asUser(pres, `select set_permission($1, 'change_positions', false)`, [vp])
})

test('notes need the Write notes switch; writers delete their own', async () => {
  const pres = await ownerId()
  const vp = (await one(`select id from profiles where student_id = '20000090'`)).id
  const sec = (await one(`select id from profiles where student_id = '20000092'`)).id
  await rejects(asUser(sec, `select add_exco_note($1, 'Handles booking issues')`, [vp]), 'NOT_ALLOWED')
  await asUser(pres, `select set_permission($1, 'write_notes', true)`, [sec])
  await rejects(asUser(sec, `select add_exco_note($1, '   ')`, [vp]), 'NOTE_EMPTY')
  await asUser(sec, `select add_exco_note($1, 'Handles booking issues')`, [vp])
  const note = (await one('select id from exco_notes where about = $1', [vp])).id
  const [{ people_overview: v }] = await asUser(vp, 'select people_overview()')
  assert.equal(v.people.find((p) => p.id === vp).notes[0].body, 'Handles booking issues')
  await rejects(asUser(vp, 'select delete_exco_note($1)', [note]), 'NOT_ALLOWED')
  await asUser(sec, 'select delete_exco_note($1)', [note])
  assert.equal((await one('select count(*)::int as n from exco_notes')).n, 0)
})
