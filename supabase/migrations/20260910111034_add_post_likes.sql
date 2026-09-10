create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_post_user_unique unique (post_id, user_id)
);

create index if not exists post_likes_post_id_idx on public.post_likes(post_id);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);

alter table public.post_likes enable row level security;

create policy "Anyone can view post likes"
on public.post_likes for select
using (true);

create policy "Authenticated users can like posts"
on public.post_likes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can remove their own post likes"
on public.post_likes for delete
to authenticated
using (auth.uid() = user_id);
