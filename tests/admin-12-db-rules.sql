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
do $$
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
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.admin_save_catalog_filters(array['wattage'],'[]'::jsonb);
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
select public.review_expect_rows(
 'delete from public.business_privacy_settings where id=1',0);
select public.review_expect_42501(
 'insert into public.business_bank_accounts(id,bank_name) values(2,''forbidden bank'')');

-- Bank ON: independent bank edit; company privacy and global site settings denied.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.owner_set_admin2_settings('assistant@example.invalid',array['bank-settings']);
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
insert into public.business_bank_accounts(id,bank_name) values(1,'fixture bank');
select public.review_expect_rows(
 'update public.business_privacy_settings set retention_days=155 where id=1',0);
select public.review_expect_rows(
 'update public.site_settings set quote_list_enabled=true where id=1',0);

-- Test anonymous client cannot invoke the new RPCs.
reset role;
set role anon;
set request.jwt.claim.sub='';
select public.review_expect_42501(
 'select public.admin_set_site_toggle(''quote_list_enabled'',true)');
select public.review_expect_42501(
 'select public.owner_get_delegatable_permissions()');
reset role;

-- All test row writes occurred exclusively in the isolated CI service.
\echo ADMIN_12_POSTGRES_SECURITY_OK
