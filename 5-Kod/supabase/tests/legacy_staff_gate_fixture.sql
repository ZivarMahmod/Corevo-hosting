-- Old procedural suites may create active staff without onboarding fixtures.
-- The transaction started by legacy_module_gate_fixture restores this trigger.
alter table public.staff disable trigger trg_staff_activation_readiness;
