create table if not exists public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists comment_replies_comment_id_created_at_idx
  on public.comment_replies(comment_id, created_at);

alter table public.comment_replies enable row level security;

create policy "Anyone can view comment replies"
  on public.comment_replies for select
  using (true);

create policy "Authenticated users can create comment replies"
  on public.comment_replies for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own comment replies"
  on public.comment_replies for delete
  to authenticated
  using (auth.uid() = user_id);
