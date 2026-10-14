-- Disposable CI database ONLY: synthetic identities, no Supabase URL or credentials.
\set ON_ERROR_STOP on
create function public.review_expect_42501(p_statement text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_statement;
  exception when sqlstate '42501' then
    return;
  end;
  raise exception 'Expected access denied (42501): %',p_statement;
end;
$$;
create function public.review_expect_rows(p_statement text,p_expected int)
returns void language plpgsql security invoker as $$
declare touched integer;
begin
  execute p_statement;
  get diagnostics touched=row_count;
  if touched is distinct from p_expected then
    raise exception 'Expected % changed rows, saw % in %',p_expected,touched,p_statement;
  end if;
end;
$$;

set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
set request.jwt.claim.role='authenticated';
do $
begin
 if public.is_site_owner() then raise exception 'Assistant detected as owner'; end if;
 if not public.has_admin_permission('leads') then raise exception 'Migration erased existing leads permission'; end if;
 if public.has_admin_permission('site-settings') then raise exception 'Migration auto-granted site-settings'; end if;
end;
$$;
select public.review_expect_42501(
 'select public.owner_get_delegatable_permissions()');
select public.review_expect_42501(
 'select public.owner_set_admin2_settings(''assistant@example.invalid'',array[''site-settings''])');
select public.review_expect_42501(
 'select public.admin_set_site_toggle(''quote_list_enabled'',false)');
select public.review_expect_42501(
 'select public.admin_save_catalog_filters(array[''wattage''],''[]''::jsonb)');
select public.review_expect_42501(
 'select public.admin_set_template_field(''design_footer_number'',''1'')');
select public.review_expect_42501(
 'select public.admin_save_template_footer(''1'',''test'')');
select public.review_expect_rows(
 'update public.site_settings set quote_list_enabled=false where id=1',0);
select public.review_expect_rows(
 'update public.business_privacy_settings set retention_days=90 where id=1',0);

-- The pre-existing leads permission authorizes retention maintenance and
-- deletes only expired synthetic rows, leaving fresh records untouched.
do $
declare removed integer;
begin
 removed:=public.purge_expired_customer_leads();
 if removed<>1 then raise exception 'Leads-only purge removed % rows (expected 1)',removed; end if;
 if (select count(*) from public.customer_leads)<>1 then
   raise exception 'Purge altered recent customer leads';
 end if;
end;
$;

-- Confirm the owner can enumerate available keys but cannot grant owner-only keys.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare keys text[];
begin
  select public.owner_get_delegatable_permissions() into keys;
  if cardinality(keys)<>12 or 'credentials'=any(keys)
     or 'permissions'=any(keys) then
    raise exception 'Invalid owner capability list: %',keys;
  end if;
end;
$$;
-- Unsupported grants must fail before any role assignment is changed.
do $$
begin
  begin
    perform public.owner_set_admin2_settings(
      'assistant@example.invalid',array['permissions']);
  exception when sqlstate '22023' then return;
  end;
  raise exception 'Owner-only permissions unexpectedly delegated';
end;
$$;

-- Search-filters ON: may update exactly filters, NOT site toggle or barcode.
select public.owner_set_admin2_settings('assistant@example.invalid',array['search-filters']);
-- Restore an expired synthetic row to verify that unauthorized purge fails
-- without silently deleting or changing records.
reset role;
insert into public.customer_leads(id,created_at) values(3,now()-interval '250 days');
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.admin_save_catalog_filters(array['wattage'],'[]'::jsonb);
select public.review_expect_42501('select public.purge_expired_customer_leads()');
select public.review_expect_42501(
 'select public.admin_set_site_toggle(''quote_list_enabled'',false)');
select public.review_expect_42501(
 'select public.admin_set_template_field(''design_footer_number'',''1'')');
select public.review_expect_rows(
 'update public.site_settings set quote_list_enabled=false where id=1',0);
select public.review_expect_rows(
 'update public.business_privacy_settings set retention_days=90 where id=1',0);

-- Site-settings ON: may edit toggle, NOT filters, template, bank/company.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['site-settings']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.admin_set_site_toggle('quote_list_enabled',false);
select public.review_expect_42501('select public.purge_expired_customer_leads()');
select public.review_expect_42501(
 'select public.admin_save_catalog_filters(array[''cct''],''[]''::jsonb)');
select public.review_expect_42501(
 'select public.admin_save_template_footer(''123'',''footer'')');
select public.review_expect_rows(
 'update public.site_settings set quote_list_enabled=true where id=1',0);

-- Template ON: may change only allowed footer fields or barcode.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['template-settings']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.admin_save_template_footer('01234','supplier');
select public.review_expect_42501('select public.purge_expired_customer_leads()');
select public.review_expect_42501(
 'select public.admin_set_site_toggle(''quote_list_enabled'',true)');
select public.review_expect_42501(
 'select public.admin_save_catalog_filters(array[''cri''],''[]''::jsonb)');
insert into storage.objects(id,bucket_id,name) values
 (10,'product-images','site-settings/master-barcode-00000000-0000-4000-8000-000000000000.png');
select public.review_expect_42501(
 'insert into storage.objects(id,bucket_id,name) values (11,''product-images'',''site-assets/evil.png'')');
select public.review_expect_42501(
 'insert into storage.objects(id,bucket_id,name) values (12,''product-images'',''products/evil.png'')');

-- Business ON: can upsert privacy but cannot delete its singleton or edit bank.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['business-settings']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.review_expect_rows(
 'update public.business_privacy_settings set retention_days=160 where id=1',1);
select public.review_expect_42501('select public.purge_expired_customer_leads()');
select public.review_expect_rows(
 'delete from public.business_privacy_settings where id=1',0);
select public.review_expect_42501(
 'insert into public.business_bank_accounts(id,bank_name) values(2,''forbidden bank'')');

-- Bank ON: independent bank edit; company privacy and global site settings denied.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['bank-settings']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
insert into public.business_bank_accounts(id,bank_name) values(1,'fixture bank');
select public.review_expect_42501('select public.purge_expired_customer_leads()');
select public.review_expect_rows(
 'update public.business_privacy_settings set retention_days=155 where id=1',0);
select public.review_expect_rows(
 'update public.site_settings set quote_list_enabled=true where id=1',0);

-- Sections permission alone may edit category but must not delete it.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['sections']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.review_expect_rows(
 'update public.categories set name=''Category renamed'' where id=1',1);
select public.review_expect_rows(
 'delete from public.categories where id=1',0);
-- Even products-only cannot delete a category; both keys are required.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['products']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.review_expect_rows(
 'delete from public.categories where id=1',0);
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',
 array['sections','products']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.review_expect_rows(
 'delete from public.categories where id=1',1);

-- Test anonymous client cannot invoke the new RPCs.
reset role;
set role anon;
set request.jwt.claim.sub='';
set request.jwt.claim.role='anon';
select public.review_expect_42501('select public.purge_expired_customer_leads()');
select public.review_expect_42501(
 'select public.admin_set_site_toggle(''quote_list_enabled'',true)');
select public.review_expect_42501(
 'select public.owner_get_delegatable_permissions()');
reset role;

-- Preserve the existing service_role maintenance path for scheduled jobs.
-- It is not an interactive admin and is the only API role exempt from the
-- delegated leads permission check.
set role service_role;
set request.jwt.claim.role='service_role';
set request.jwt.claim.sub='';
do $
declare removed integer;
begin
  removed:=public.purge_expired_customer_leads();
  if removed<>1 then raise exception 'service_role retention purge removed % rows, expected 1',removed; end if;
end;
$;
reset role;
do $
begin
  if (select count(*) from public.customer_leads)<>1 then
    raise exception 'Unauthorised purge or service-role retention changed unexpected records';
  end if;
end;
$;

-- All test row writes occurred exclusively in the isolated CI service.
\echo ADMIN_12_POSTGRES_SECURITY_OK
