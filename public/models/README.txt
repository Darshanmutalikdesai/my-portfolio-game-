hero.glb   = Business_Male_04        -> the player character (walk / run / idle driven by code)
crowd.glb  = Construction_Female_01  -> the pedestrians walking the sidewalks

Both are rigged (Biped skeleton) but have no animation clips, so src/People.jsx animates the
legs, knees, feet and arms procedurally. Characters must face +Z and stand with feet at y = 0.
To swap a model, replace the .glb with the same filename. Models that DO contain clips named
"idle" / "walk" / "run" are played automatically for the hero.

Tuning knobs are at the top of src/People.jsx: HERO_SCALE, CROWD_COUNT, CROWD_RANGE, ARM_DOWN.
Credit: Microsoft Rocketbox (MIT) - see LICENSE-Rocketbox.txt
