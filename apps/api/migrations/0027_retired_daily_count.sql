/* T-10-055 한국 시각 날짜별 은퇴 수(app_meta `retired:YYYY-MM-DD`)를 지금까지의 은퇴 기록으로 채운다.
   이후로는 은퇴 업로드가 그날 키를 1씩 올린다. 이 migration과 새 API 배포 사이에 들어온 은퇴는 세지 않는다. */
INSERT INTO app_meta (key, value)
SELECT 'retired:' || substr(datetime(retired_at, '+9 hours'), 1, 10), count(*)
FROM careers
WHERE status = 'retired' AND retired_at IS NOT NULL
GROUP BY 1
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
