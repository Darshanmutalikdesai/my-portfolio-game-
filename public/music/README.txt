IN-GAME MUSIC
=============
By default the game plays a built-in generated radio (NEON DRIVE / MIDNIGHT TRAP / SUNSET FUNK). Nothing to do.

TO USE REAL SONGS INSTEAD
1) Put your .mp3 files in this folder (public/music/).
2) Create a file here called  playlist.json  like this:

   [
     { "file": "drive.mp3",  "title": "Neon Highway" },
     { "file": "night.mp3",  "title": "Midnight Run" },
     { "file": "chill.mp3",  "title": "Sunset Cruise" }
   ]

3) Restart `npm run dev`. N = next song, M = mute. Songs play in order and loop.
   (Delete playlist.json to go back to the built-in radio.)

LICENSING - only use music you have the right to use on a public website:
  - Pixabay Music (free licence, search "synthwave", "retrowave", "trap", "action", "driving")
  - Free Music Archive / Incompetech (Kevin MacLeod) - check each track's licence; many need credit
  - Uppbeat, YouTube Audio Library (check the terms before publishing elsewhere)
Add any required credits to your portfolio page. Do NOT use commercial game / radio songs.
