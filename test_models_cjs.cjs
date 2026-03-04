const fal = require("@fal-ai/client");

fal.config({ credentials: process.env.FAL_KEY });

async function main() {
  const models = [
    'fal-ai/flux-pulid',
    'fal-ai/flux/dev',
    'fal-ai/flux-lora',
    'fal-ai/flux-kontext/pro/v1',
    'fal-ai/omni-zero',
  ];

  for (const model of models) {
    try {
      console.log('Testing:', model);
      const result = await fal.subscribe(model, {
        input: {
          prompt: 'A professional headshot of a young Asian man in a suit, studio lighting',
          image_size: 'square_hd',
        },
        pollInterval: 1000,
      });
      const imgs = result.data?.images || result.images;
      console.log('  SUCCESS! Images:', imgs?.length, 'URL:', imgs?.[0]?.url?.substring(0, 80));
    } catch(e) {
      console.log('  Error:', e.message?.substring(0, 200));
    }
  }
}

main();
