-- Cleanup old tables from previous projects before Prisma push
-- This drops ALL public tables to start fresh

DROP TABLE IF EXISTS public."ApiKey" CASCADE;
DROP TABLE IF EXISTS public."Generation" CASCADE;
DROP TABLE IF EXISTS public."OCLiteDiagrams" CASCADE;
DROP TABLE IF EXISTS public."Transaction" CASCADE;
DROP TABLE IF EXISTS public."AiModel" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public._prisma_migrations CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.credit_score_cycles CASCADE;
DROP TABLE IF EXISTS public.ledger_audit_log CASCADE;
DROP TABLE IF EXISTS public.telegram_links CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.extracted_finance_data CASCADE;
DROP TABLE IF EXISTS public.fraud_scans CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
