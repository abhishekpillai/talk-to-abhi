Install Replicate’s Node.js client library:
```
npm install replicate
```

Import and set up the client:
```
import Replicate from "replicate";
import fs from "node:fs";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
```

Run sync/lipsync-2 using Replicate’s API. Check out the model's schema for an overview of inputs and outputs.
```
const input = {
  audio: "https://assets.sync.so/replicate/audio.mp3",
  video: "https://assets.sync.so/replicate/video.mp4",
  sync_mode: "loop",
  temperature: 0.5
};

const output = await replicate.run("sync/lipsync-2", { input });

// To access the file URL:
console.log(output.url()); //=> "http://example.com"

// To write the file to disk:
fs.writeFile("my-image.png", output);
```