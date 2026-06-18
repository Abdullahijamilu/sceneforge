# SceneForge AI

SceneForge AI is a powerful, streamlined application designed to transform your scripts into professional faceless YouTube videos with AI-generated visuals, voiceover synchronization, and auto-subtitles.

## 🚀 Features
- **AI Scene Splitting**: Automatically divides your raw text script into logical visual scenes.
- **AI Image Generation**: Built-in free AI image generation (powered by Pollinations.ai) to instantly generate visuals for every scene.
- **Audio Sync**: Upload a voiceover track and the app automatically aligns your scene timings.
- **Video Rendering**: Customize aspect ratio (16:9, 9:16, 1:1), resolution (1080p, 4K), and subtitle styles before rendering the final MP4.
- **Serverless Architecture**: Uses Vercel Edge Functions to securely proxy AI requests and bypass browser CORS limitations.

---

## 🛠️ How It Works (Documentation)

SceneForge AI operates primarily in the browser, providing a rapid editing experience, combined with a lightweight serverless backend.

### 1. Script Processing (`script-parser.js`)
When you paste a script, the `ScriptParser` automatically splits the text into manageable scenes based on line breaks and natural pauses. For every scene, it parses the text and automatically generates a highly descriptive AI image generation prompt.

### 2. Audio Integration (`audio-manager.js`)
Users upload their primary voiceover track. The `AudioManager` reads the file, generates a visual waveform on an HTML5 Canvas, and calculates the total duration. It then automatically distributes this duration across all generated scenes to keep visuals perfectly synced with the audio.

### 3. Scene Editing & AI Generation (`scene-editor.js` & `/api/generate.js`)
In the scene editor, users can tweak durations, add Ken Burns effects, and configure transitions. 
When a user clicks "Generate with AI", the frontend pings the custom `/api/generate` Serverless Edge Function. 
* **Why a Serverless Function?** Browsers strictly enforce CORS (Cross-Origin Resource Sharing). Fetching images directly from external AI APIs in JavaScript often results in blocked requests. The serverless `/api/generate.js` acts as a secure middleman, fetching the image on the backend and streaming it directly to the frontend safely.

### 4. Rendering & Export (`video-renderer.js`)
Once the timeline is complete, the `VideoRenderer` takes over. It utilizes HTML5 Canvas rendering to frame each scene, apply zooming/panning (Ken Burns), draw styled subtitles over the video, and handle transitions between scenes. The final output is packaged into a downloadable `.mp4` video.

---

## 💻 Local Development

Because this project utilizes Serverless functions, running it strictly via `file:///index.html` will break the AI generation feature. To run it locally:

1. Install the [Vercel CLI](https://vercel.com/docs/cli): 
   ```bash
   npm i -g vercel
   ```
2. Start the local development server:
   ```bash
   vercel dev
   ```
3. Open your browser to `http://localhost:3000`


## 👨‍💻 About the Founder

**Abdullahi Jamilu Ohiare**  
*Software Engineer, YouTuber, and AI Specialist*

SceneForge AI was created by Abdullahi Jamilu Ohiare out of a passion for leveraging artificial intelligence to empower creators. As a software engineer and AI specialist, Abdullahi focuses on building intuitive, high-performance tools that automate complex workflows—making professional content creation accessible to everyone.
