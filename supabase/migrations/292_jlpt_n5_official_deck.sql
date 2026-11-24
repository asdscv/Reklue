-- Official Japanese cards show a kana reading and use Japanese speech.
-- Group their localized public previews together and sample across the full deck.
BEGIN;

INSERT INTO card_templates (
  id, user_id, name, fields, front_layout, back_layout, is_default
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000001',
  'Official Japanese Word',
  '[
    {"key":"front","name":"Front","type":"text","order":0,"tts_lang":"ja-JP","tts_enabled":true},
    {"key":"reading","name":"Reading","type":"text","order":1},
    {"key":"back","name":"Back","type":"text","order":2},
    {"key":"example_front","name":"Front Example","type":"text","order":3,"tts_lang":"ja-JP","tts_enabled":true},
    {"key":"example_back","name":"Back Example","type":"text","order":4}
  ]'::jsonb,
  '[
    {"field_key":"front","style":"primary"},
    {"field_key":"reading","style":"detail"},
    {"field_key":"example_front","style":"detail"}
  ]'::jsonb,
  '[
    {"field_key":"back","style":"primary"},
    {"field_key":"example_back","style":"detail"}
  ]'::jsonb,
  false
);

CREATE OR REPLACE FUNCTION get_public_listing_preview(p_listing_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', ml.id,
    'title', ml.title,
    'description', ml.description,
    'tags', ml.tags,
    'category', ml.category,
    'card_count', ml.card_count,
    'acquire_count', ml.acquire_count,
    'share_mode', ml.share_mode,
    'created_at', ml.created_at,
    'owner_name', p.display_name,
    'owner_is_official', p.is_official,
    'native_language', ml.native_language,
    'learning_language', ml.learning_language,
    'study_level', ml.study_level,
    'sample_fields', (
      SELECT COALESCE(json_agg(
        json_build_object('field_values', s.field_values)
        ORDER BY s.sort_position, s.id
      ), '[]'::json)
      FROM (
        SELECT r.field_values, r.sort_position, r.id
        FROM (
          SELECT c2.field_values, c2.sort_position, c2.id,
                 row_number() OVER (ORDER BY c2.sort_position, c2.id) - 1 AS rn,
                 count(*) OVER () AS total
          FROM cards c2
          WHERE c2.deck_id = ml.deck_id
        ) r
        WHERE CASE
          WHEN p.is_official AND ml.tags @> ARRAY['source:ja', 'learning_language:ja'] THEN
            r.total <= 50 OR r.rn IN (
              SELECT i * (r.total - 1) / 49 FROM generate_series(0, 49) AS positions(i)
            )
          WHEN p.is_official THEN
            r.rn % GREATEST(1, r.total / 50) = 0
            AND r.rn / GREATEST(1, r.total / 50) < 50
          ELSE r.rn < 10
        END
      ) s
    ),
    'siblings', (
      SELECT COALESCE(json_agg(
        json_build_object('id', sib.id, 'native_language', sib.native_language)
        ORDER BY sib.native_language
      ), '[]'::json)
      FROM marketplace_listings sib
      WHERE p.is_official
        AND sib.id <> ml.id
        AND sib.is_active = true
        AND sib.owner_is_official = true
        AND sib.category = ml.category
        AND (SELECT t FROM unnest(ml.tags) t WHERE t LIKE 'level:%' LIMIT 1) IS NOT NULL
        AND sib.tags @> ARRAY[
          (SELECT t FROM unnest(ml.tags) t WHERE t LIKE 'level:%' LIMIT 1)
        ]
        AND CASE
          WHEN ml.tags @> ARRAY['source:ja', 'learning_language:ja'] THEN
            sib.tags @> ARRAY['source:ja', 'learning_language:ja']
          WHEN ml.tags @> ARRAY['source:en'] THEN sib.tags @> ARRAY['source:en']
          WHEN ml.tags @> ARRAY['target:en'] THEN
            sib.tags @> ARRAY['target:en']
            AND NOT (sib.tags @> ARRAY['source:ja', 'learning_language:ja'])
          ELSE false
        END
    )
  ) INTO result
  FROM marketplace_listings ml
  JOIN profiles p ON p.id = ml.owner_id
  WHERE ml.id = p_listing_id
    AND ml.is_active = true;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_listing_preview(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
