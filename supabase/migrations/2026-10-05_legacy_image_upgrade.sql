-- v101: Owner-only atomic replacement. Original storage objects are retained.
begin;
create or replace function public.replace_legacy_product_image_for_owner(p_old_path text,p_new_path text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare a integer; b integer;
begin
  if not coalesce(public.is_site_owner(),false) then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_old_path is null or p_old_path='' or p_new_path is null
     or p_new_path !~ '^[a-zA-Z0-9_-]+/[a-zA-Z0-9-]+\.l\.webp$'
     or p_old_path=p_new_path then
    raise exception 'Invalid image paths';
  end if;
  update public.products set image_path=p_new_path where image_path=p_old_path;
  get diagnostics a = row_count;
  update public.product_images set image_path=p_new_path where image_path=p_old_path;
  get diagnostics b = row_count;
  if a+b=0 then raise exception 'Image references changed; refresh and retry'; end if;
  return a+b;
end;
$$;
revoke all on function public.replace_legacy_product_image_for_owner(text,text) from public,anon;
grant execute on function public.replace_legacy_product_image_for_owner(text,text) to authenticated;
commit;
notify pgrst,'reload schema';
select 'LEGACY_IMAGE_UPGRADE_OK' as status;
