# Thread Links

The desktop app (macOS) and the mobile app open links to a thread:

```
t3code://threads/<environmentId>/<threadId>
```

Opening one brings T3 Code to the front, opening a window if none is open, and shows that thread. A link that arrives
while the app starts or reconnects waits until it's ready. Anything that isn't exactly this shape is ignored, so a
link can only open a thread.

Useful for anything that records which thread produced something, such as a notification, a log line or a dashboard.
