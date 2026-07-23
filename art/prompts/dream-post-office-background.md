# Dream Post Office — background generation prompt

Model: `gpt-image-2`

Use case: stylized-concept  
Asset type: vertical mobile game environment background  
Primary request: an original dream post office sorting hall for a surreal puzzle game, where undelivered dreams are processed at night  
Scene/backdrop: a tall intimate postal room with curved brass mail chutes, mismatched pigeonhole cabinets, a crescent-shaped service window, softly floating sealed envelopes, a small central sorting desk, hanging glass lamps, and distant clouds visible through the window  
Style/medium: original hand-painted gouache and layered paper-collage illustration, tactile paper fibers, elegant editorial storybook finish, clearly distinct from existing games  
Composition/framing: portrait 9:16 mobile composition, straight-on room view, strong depth, central lower area kept visually calm for interactive puzzle objects, upper and side areas richly dressed, no character in this background  
Lighting/mood: quiet midnight dream atmosphere, gentle mysterious warmth, inviting rather than horror  
Color palette: deep indigo, muted dusty rose, aged cream paper, oxidized teal, warm brass highlights; full color  
Materials/textures: handmade paper, worn wood, brushed brass, cloudy glass, wax seals  
Constraints: no text, no readable letters or numbers, no logos, no watermark, no monochrome black-and-white treatment, no trees or branches, no direct visual references to HER TREES, no existing characters, no UI buttons, no frame or phone mockup

Suggested CLI output:

```bash
python "$HOME/.codex/skills/.system/imagegen/scripts/image_gen.py" generate \
  --model gpt-image-2 \
  --quality high \
  --size 1024x1536 \
  --prompt-file art/prompts/dream-post-office-background.md \
  --out assets/dream-post-office-hall.png
```
