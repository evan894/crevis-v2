-- Create product-images bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict do nothing;

-- Allow authenticated users to upload
create policy "product_images_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Allow public read
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Allow sellers to delete their own images
create policy "product_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and auth.uid()::text = owner);
