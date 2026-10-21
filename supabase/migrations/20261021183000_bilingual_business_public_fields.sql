-- Flower Light: bilingual owner-managed public company information
-- Additive and repeatable. Does not overwrite or translate existing rows.
-- Run only after reviewing/approving this migration.
begin;

alter table public.business_public_fields
  add column if not exists label_en text not null default ''
    check (char_length(label_en) <= 80);

alter table public.business_public_fields
  add column if not exists value_en text not null default ''
    check (char_length(value_en) <= 300);

-- Keep the existing visibility guard, row ordering, retention setting,
-- security-definer behavior, and no-visibility => empty result contract.
create or replace function public.get_public_business_privacy()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when s.show_all then jsonb_strip_nulls(jsonb_build_object(
      'fields', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',f.id,
            'label',f.label,
            'label_en',f.label_en,
            'value',f.value,
            'value_en',f.value_en,
            'sort_order',f.sort_order
          ) order by f.sort_order,f.created_at,f.id
        )
        from public.business_public_fields f
        where f.is_visible=true and btrim(f.label)<>'' and btrim(f.value)<>''
      ),'[]'::jsonb),
      'retention_days',case when s.show_retention_days then s.retention_days end
    )) else '{}'::jsonb end
    from public.business_privacy_settings s
    where s.id=1
  ),'{}'::jsonb);
$$;

-- Preserve public read through the filtered function, not direct table SELECT.
revoke all on function public.get_public_business_privacy() from public;
grant execute on function public.get_public_business_privacy() to anon,authenticated;

commit;
notify pgrst,'reload schema';
select 'BILINGUAL_BUSINESS_FIELDS_READY' as status;
