-- THE PUSSY IS YOURS · NON-DESTRUCTIVE PREMIUM RELEASE
-- Requires the previously installed tgy_* social tables and friendship/private-media policies.
-- Does not delete or rename any existing rows, OAuth users, or media.

create table if not exists public.tpy_user_settings (
 user_id uuid primary key references public.tgy_accounts(id) on delete cascade,
 allow_profile_view_notifications boolean not null default true,
 allow_message_notifications boolean not null default true,
 allow_social_notifications boolean not null default true,
 discoverable boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.tpy_user_settings enable row level security;
drop policy if exists "settings owner read" on public.tpy_user_settings;
create policy "settings owner read" on public.tpy_user_settings for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "settings owner create" on public.tpy_user_settings;
create policy "settings owner create" on public.tpy_user_settings for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "settings owner edit" on public.tpy_user_settings;
create policy "settings owner edit" on public.tpy_user_settings for update to authenticated using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update on public.tpy_user_settings to authenticated;

create table if not exists public.tpy_follows (
 follower_id uuid not null references public.tgy_accounts(id) on delete cascade,
 followed_id uuid not null references public.tgy_accounts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,followed_id),
 check(follower_id<>followed_id)
);
alter table public.tpy_follows enable row level security;
drop policy if exists "follow read" on public.tpy_follows;
create policy "follow read" on public.tpy_follows for select to authenticated using(true);
drop policy if exists "follow self" on public.tpy_follows;
create policy "follow self" on public.tpy_follows for insert to authenticated with check(follower_id=(select auth.uid()) and not exists(select 1 from public.tgy_blocks b where (b.blocker_id=follower_id and b.blocked_id=followed_id) or (b.blocker_id=followed_id and b.blocked_id=follower_id)));
drop policy if exists "unfollow self" on public.tpy_follows;
create policy "unfollow self" on public.tpy_follows for delete to authenticated using(follower_id=(select auth.uid()));
grant select,insert,delete on public.tpy_follows to authenticated;
create index if not exists tpy_follows_target on public.tpy_follows(followed_id);

create table if not exists public.tpy_bookmarks (
 user_id uuid not null references public.tgy_accounts(id) on delete cascade,
 post_id uuid not null references public.tgy_posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
alter table public.tpy_bookmarks enable row level security;
drop policy if exists "bookmark owner read" on public.tpy_bookmarks;
create policy "bookmark owner read" on public.tpy_bookmarks for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.tgy_posts p where p.id=post_id));
drop policy if exists "bookmark owner insert" on public.tpy_bookmarks;
create policy "bookmark owner insert" on public.tpy_bookmarks for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.tgy_posts p where p.id=post_id));
drop policy if exists "bookmark owner delete" on public.tpy_bookmarks;
create policy "bookmark owner delete" on public.tpy_bookmarks for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,delete on public.tpy_bookmarks to authenticated;

create table if not exists public.tpy_stories (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.tgy_accounts(id) on delete cascade,
 media_path text not null,
 media_type text not null check(media_type in ('image','video')),
 caption text not null default '' check(length(caption)<=500),
 visibility text not null default 'friends' check(visibility in ('public','friends')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.tpy_stories enable row level security;
drop policy if exists "story readable" on public.tpy_stories;
create policy "story readable" on public.tpy_stories for select to authenticated using (
 expires_at>now() and (author_id=(select auth.uid()) or
 (visibility='public' and not exists(select 1 from public.tgy_blocks b where (b.blocker_id=author_id and b.blocked_id=(select auth.uid())) or (b.blocked_id=author_id and b.blocker_id=(select auth.uid())))) or
 (visibility='friends' and exists(select 1 from public.tgy_friendships f where f.user_a=least(author_id,(select auth.uid())) and f.user_b=greatest(author_id,(select auth.uid())))))
);
drop policy if exists "guest public story read" on public.tpy_stories;
create policy "guest public story read" on public.tpy_stories for select to anon using(visibility='public' and expires_at>now());
drop policy if exists "story create" on public.tpy_stories;
create policy "story create" on public.tpy_stories for insert to authenticated with check(author_id=(select auth.uid()) and expires_at<=now()+interval '25 hours' and split_part(media_path,'/',1)=author_id::text);
drop policy if exists "story delete" on public.tpy_stories;
create policy "story delete" on public.tpy_stories for delete to authenticated using(author_id=(select auth.uid()));
grant select on public.tpy_stories to anon;
grant select,insert,delete on public.tpy_stories to authenticated;
create index if not exists tpy_stories_recent on public.tpy_stories(created_at desc);
create index if not exists tpy_stories_expiry on public.tpy_stories(expires_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tpy-stories','tpy-stories',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do nothing;
drop policy if exists "tpy upload story" on storage.objects;
create policy "tpy upload story" on storage.objects for insert to authenticated with check(bucket_id='tpy-stories' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "tpy read story" on storage.objects;
create policy "tpy read story" on storage.objects for select to authenticated using(bucket_id='tpy-stories' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.tpy_stories s where s.media_path=name)));
drop policy if exists "tpy guest story" on storage.objects;
create policy "tpy guest story" on storage.objects for select to anon using(bucket_id='tpy-stories' and exists(select 1 from public.tpy_stories s where s.media_path=name and s.visibility='public' and s.expires_at>now()));
drop policy if exists "tpy delete own story media" on storage.objects;
create policy "tpy delete own story media" on storage.objects for delete to authenticated using(bucket_id='tpy-stories' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Admin roles cannot be self-created by browser clients. Assign securely in SQL Editor.
create table if not exists public.tpy_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'moderator' check(role in ('moderator','admin')),
 created_at timestamptz not null default now()
);
alter table public.tpy_admins enable row level security;
drop policy if exists "admin own lookup" on public.tpy_admins;
create policy "admin own lookup" on public.tpy_admins for select to authenticated using(user_id=(select auth.uid()));
grant select on public.tpy_admins to authenticated;
revoke insert,update,delete on public.tpy_admins from authenticated,anon;

create table if not exists public.tpy_content_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.tgy_accounts(id) on delete cascade,
 target_user_id uuid references public.tgy_accounts(id) on delete set null,
 target_post_id uuid references public.tgy_posts(id) on delete set null,
 reason text not null check(length(reason) between 5 and 1000),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.tgy_accounts(id) on delete set null,
 check(target_user_id is not null or target_post_id is not null)
);
alter table public.tpy_content_reports enable row level security;
drop policy if exists "reports submit" on public.tpy_content_reports;
create policy "reports submit" on public.tpy_content_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
drop policy if exists "reports sender or moderator" on public.tpy_content_reports;
create policy "reports sender or moderator" on public.tpy_content_reports for select to authenticated using(reporter_id=(select auth.uid()) or exists(select 1 from public.tpy_admins a where a.user_id=(select auth.uid())));
drop policy if exists "reports moderator update" on public.tpy_content_reports;
create policy "reports moderator update" on public.tpy_content_reports for update to authenticated using(exists(select 1 from public.tpy_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.tpy_admins a where a.user_id=(select auth.uid())));
grant select,insert on public.tpy_content_reports to authenticated;
grant update(status,reviewed_at,reviewed_by) on public.tpy_content_reports to authenticated;
create index if not exists tpy_reports_status_time on public.tpy_content_reports(status,created_at desc);

-- Operational deletion requests are not automated account deletion.
create table if not exists public.tpy_deletion_requests (
 user_id uuid primary key references public.tgy_accounts(id) on delete cascade,
 requested_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','processing','completed'))
);
alter table public.tpy_deletion_requests enable row level security;
drop policy if exists "deletion self read" on public.tpy_deletion_requests;
create policy "deletion self read" on public.tpy_deletion_requests for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.tpy_admins a where a.user_id=(select auth.uid())));
drop policy if exists "deletion self request" on public.tpy_deletion_requests;
create policy "deletion self request" on public.tpy_deletion_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
grant select,insert on public.tpy_deletion_requests to authenticated;

-- Respect user preferences when notification INSERT events fire.
create or replace function public.tpy_filter_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare prefs public.tpy_user_settings%rowtype;
begin
 select * into prefs from public.tpy_user_settings where user_id=new.user_id;
 if not found then return new; end if;
 if new.kind='profile_view' and not prefs.allow_profile_view_notifications then return null; end if;
 if new.kind='message' and not prefs.allow_message_notifications then return null; end if;
 if new.kind in ('reaction','comment','share','friend_request','friend_accepted','follow') and not prefs.allow_social_notifications then return null; end if;
 return new;
end $$;
revoke all on function public.tpy_filter_notification() from public,anon,authenticated;
drop trigger if exists tpy_notification_preferences on public.tgy_notifications;
create trigger tpy_notification_preferences before insert on public.tgy_notifications for each row execute function public.tpy_filter_notification();

-- This function grants only owners access to their own request, keeping deletion explicit.
notify pgrst,'reload schema';

-- Private precision-preserving coordinates. The public map receives only approximate pins.
create table if not exists public.tpy_exact_locations (
 user_id uuid primary key references public.tgy_accounts(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_m integer check(accuracy_m between 0 and 1000000),
 updated_at timestamptz not null default now()
);
alter table public.tpy_exact_locations enable row level security;
drop policy if exists "exact coordinates self read" on public.tpy_exact_locations;
create policy "exact coordinates self read" on public.tpy_exact_locations for select to authenticated using(user_id=(select auth.uid()));
grant select on public.tpy_exact_locations to authenticated;
revoke insert,update,delete on public.tpy_exact_locations from authenticated,anon;

create or replace function public.tgy_set_location(p_lat double precision, p_lng double precision,p_accuracy integer default null,p_visible boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());h bigint;alat numeric;alng numeric;
begin
 if me is null then raise exception 'Authentication required';end if;
 if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then raise exception 'Invalid coordinates';end if;
 if p_accuracy is not null and (p_accuracy<0 or p_accuracy>1000000) then raise exception 'Invalid GPS accuracy';end if;
 insert into public.tpy_exact_locations(user_id,latitude,longitude,accuracy_m,updated_at)
 values(me,p_lat,p_lng,p_accuracy,now())
 on conflict(user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=now();
 -- 1/100 degree grid (~1 km latitude), with a small consistent user-specific offset.
 -- Never leak the exact location to the public-location table.
 h:=('x'||substr(md5(me::text),1,8))::bit(32)::bigint;
 alat:=greatest(-90,least(90,round(p_lat::numeric,2)+((h%29)::numeric-14)/10000));
 alng:=greatest(-180,least(180,round(p_lng::numeric,2)+(((h/29)%29)::numeric-14)/10000));
 insert into public.tgy_locations(user_id,latitude,longitude,is_visible,updated_at)
 values(me,alat,alng,p_visible,now())
 on conflict(user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,is_visible=excluded.is_visible,updated_at=now();
end $$;
revoke all on function public.tgy_set_location(double precision,double precision,integer,boolean) from public,anon;
grant execute on function public.tgy_set_location(double precision,double precision,integer,boolean) to authenticated;
notify pgrst,'reload schema';

-- Follow events: passive follower notification without user-supplied recipient.
create or replace function public.tpy_notify_follow()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.follower_id<>new.followed_id then
  insert into public.tgy_notifications(user_id,kind,payload)
  values(new.followed_id,'follow',jsonb_build_object('actor_id',new.follower_id));
 end if;
 return new;
end $$;
revoke all on function public.tpy_notify_follow() from public,anon,authenticated;
drop trigger if exists tpy_notify_follow on public.tpy_follows;
create trigger tpy_notify_follow after insert on public.tpy_follows for each row execute function public.tpy_notify_follow();
