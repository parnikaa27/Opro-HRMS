-- What one US dollar buys, set by HR. Allowances and claims are kept in USD and shown in any of these.
-- The starting rates are placeholders until HR sets real ones.
create table exchange_rate (
    currency varchar(3)     primary key check (currency in ('MVR', 'INR')),
    per_usd  numeric(12, 4) not null check (per_usd > 0),
    set_by   varchar(16)    references employee (id),
    set_on   date           not null
);
insert into exchange_rate (currency, per_usd, set_on) values ('MVR', 15.42, '2026-11-15'), ('INR', 88.00, '2026-11-15');

-- How much one person can claim for flights in a year. Set by HR per person, since flights home cost different amounts.
create table flight_allowance (
    employee_id    varchar(16)    not null references employee (id),
    allowance_year integer        not null,
    amount_usd     numeric(10, 2) not null check (amount_usd >= 0),
    set_by         varchar(16)    not null references employee (id),
    set_on         date           not null,
    primary key (employee_id, allowance_year)
);

-- A flight someone paid for and claims back, with the receipt. Counted in USD at the rate on the day it was claimed.
create table flight_claim (
    id              varchar(16)    primary key,
    employee_id     varchar(16)    not null references employee (id),
    flight_date     date           not null,
    route           varchar(80)    not null,
    amount          numeric(10, 2) not null check (amount > 0),
    currency        varchar(3)     not null check (currency in ('USD', 'MVR', 'INR')),
    amount_usd      numeric(10, 2) not null check (amount_usd > 0),
    receipt_file_id uuid           references stored_file (id),
    status          varchar(10)    not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    raised_on       date           not null,
    decided_by      varchar(16)    references employee (id),
    decided_on      date,
    decision_note   varchar(300)
);
create index flight_claim_employee on flight_claim (employee_id, flight_date);
create index flight_claim_status on flight_claim (status, raised_on);
