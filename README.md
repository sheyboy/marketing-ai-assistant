# Buzzbot - AI Marketing Assistant

Your AI-powered marketing companion. A modern web frontend for n8n marketing automation workflows. Create content, generate images, and manage your marketing tasks with Buzzbot's AI assistance.

## Features

- 🤖 **AI-Powered Chat Interface** - Natural conversation with Buzzbot
- 🎨 **Image Generation & Editing** - Create and modify images directly in chat
- 📝 **Content Creation** - Generate blog posts, LinkedIn content, and videos
- 🖼️ **Inline Image Display** - Images appear directly in chat, not as links
- 📎 **File Upload Support** - Upload images for editing and processing
- ⚙️ **Configurable Webhooks** - Easy webhook URL management
- 🧹 **Smart Message Cleaning** - AI-powered message formatting with Gemini API

## Quick Start

### Local Development
```bash
# Serve locally
python3 -m http.server 8000
# Or use any static file server
```

### Docker Deployment
```bash
# Build and run
docker build -t buzzbot .
docker run -p 3000:3000 buzzbot
```

### Docker Compose
```bash
docker-compose up -d
```

## Configuration

### Webhook URL
- **Default**: `https://n8n2.geekhouse.io/webhook-test/marketing`
- **Customizable**: Click the ⚙️ settings button to change
- **Reset**: Easy reset to default option available

### n8n Integration
The frontend sends requests in this format:
```json
{
  "message": {
    "chat": {
      "id": "unique_session_id"
    },
    "text": "user_message"
  }
}
```

## Deployment to Coolify

1. **Create New Project** in Coolify
2. **Connect Git Repository** or upload files
3. **Select Docker Build**
4. **Set Port**: 80
5. **Deploy**

### Environment Variables (Optional)
- `NODE_ENV=production`

## Architecture

```
Buzzbot Frontend → n8n Webhook → Marketing Agent → Sub-workflows
                                                 ↓
               ← Formatted Response ← Tools (Blog, Image, Video)
```

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers

## Security Features

- Content Security Policy headers
- XSS protection
- Frame options security
- HTTPS ready
- Input sanitization

## Performance

- Gzip compression enabled
- Static asset caching
- Optimized image handling
- Lazy loading support

## API Integration

### Supported n8n Tools
- `blogPost` - Create blog content
- `linkedinPost` - Generate LinkedIn posts  
- `createImage` - Generate images
- `editImage` - Modify existing images
- `video` - Create video content
- `searchImages` - Search image database

### Response Formats
The frontend handles multiple response formats:
- Text responses
- Markdown links `[text](url)`
- Binary image data
- Structured JSON responses

## Troubleshooting

### Common Issues
1. **Images not displaying**: Check webhook URL and n8n media server access
2. **Messages not sending**: Verify webhook endpoint is accessible
3. **Styling issues**: Clear browser cache and reload

### Debug Mode
Open browser console (F12) to see detailed request/response logs.

## License

MIT License - feel free to modify and distribute.

## Support

For issues related to:
- **Frontend**: Check browser console for errors
- **n8n Integration**: Verify webhook configuration
- **Deployment**: Check Coolify logs and container status