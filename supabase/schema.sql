-- Existing tables (created previously, shown for reference)
-- nutrition_logs, custom_foods, exercise_routines, workout_sessions

-- Daily nutrition goals (one row per user, upserted on save)
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calories   numeric DEFAULT 2000,
  protein    numeric DEFAULT 150,
  fat        numeric DEFAULT 65,
  carbs      numeric DEFAULT 250,
  fiber      numeric DEFAULT 25,
  sugar      numeric DEFAULT 50,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own nutrition_goals" ON public.nutrition_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Run these ALTER statements to add columns the app needs:

ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS fiber numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logged_time text,
  ADD COLUMN IF NOT EXISTS serving_amount numeric,
  ADD COLUMN IF NOT EXISTS serving_unit text;

ALTER TABLE public.custom_foods
  ADD COLUMN IF NOT EXISTS fiber numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serving_amount numeric,
  ADD COLUMN IF NOT EXISTS serving_unit text;

-- Enable RLS and add policies if not already done:

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "own nutrition_logs" ON public.nutrition_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "own custom_foods" ON public.custom_foods
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "own exercise_routines" ON public.exercise_routines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "own workout_sessions" ON public.workout_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
