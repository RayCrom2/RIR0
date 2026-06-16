# Task: Clean Database

## Status: Completed

## Steps

- [x] 1. Answer question: What is the updated_at column in nutrition_goals referring to
- [x] 2. Distinguish if nutrition_goals/date_of_birth or nutrition_goals/birth_date is used more, delete birth_date column and make date_of_birth the used colum across the codebase. migrate any missing information from birth_date to date_of_birth if needed.
- [x] 3. Provide supabase SQL editor to make a new table called "user_info" that has columns: date_of_birth, gender, height_cm, weight_kg. All of these should be migrated from nutrition_goals.
- [x] 4. Migrate columns: preferred_weight_unit, preferred_height_unit, to user_preferences table



## Notes
- make sure all references to the affected columns and tables are changed throughout the codebase

### Answer to Step 1
`updated_at` on `nutrition_goals` defaulted to `now()` at row creation but had no trigger and was never read or re-written by app code, so it was dead metadata. It now has real meaning: `Profile.jsx`'s `handleSave` (the "Daily Nutrition Goals" macro section's save action) stamps it with the current time on every save.

### Step 2 data finding
Both `birth_date` and `date_of_birth` existed on `nutrition_goals`. Live data showed `birth_date` populated on 8/8 rows and `date_of_birth` empty on all of them — `birth_date` was the actively used column. Per this task's direction, the data was copied into `date_of_birth`, `birth_date` was dropped, and all code (OnboardingModal, Profile) now reads/writes `date_of_birth`.

### Migration
Ran directly against the live Supabase project via `supabase db query --linked -f supabase/clean_database_migration.sql` (kept in the repo for reference). Created `user_info` (date_of_birth, gender, height_cm, weight_kg) with the same RLS-by-`user_id` pattern as existing tables, added `preferred_weight_unit`/`preferred_height_unit` to `user_preferences`, migrated all 8 existing users' data, then dropped the 7 migrated columns from `nutrition_goals`.
