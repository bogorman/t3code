// @effect-diagnostics nodeBuiltinImport:off - Stands in for an Electron webContents.
import { assert, describe, it } from "@effect/vitest";
import * as NodeEvents from "node:events";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as ElectronWindow from "../electron/ElectronWindow.ts";
import { THREAD_LINK_OPEN_CHANNEL, WEB_LINK_OPEN_CHANNEL } from "../ipc/channels.ts";
import * as DesktopWebLinks from "./DesktopWebLinks.ts";

const makeWindow = () => {
  const sent: Array<string> = [];
  const threads: Array<unknown> = [];
  const revealed: Array<unknown> = [];
  const webContents = Object.assign(new NodeEvents.EventEmitter(), {
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => {
      if (channel === WEB_LINK_OPEN_CHANNEL) sent.push(payload as string);
      if (channel === THREAD_LINK_OPEN_CHANNEL) threads.push(payload);
    },
  });
  const window = { webContents } as unknown as Electron.BrowserWindow;
  /** The web app starts loading a new page, as a reload does. */
  const reload = () =>
    webContents.emit("did-start-navigation", { isMainFrame: true, isSameDocument: false });
  const layer = DesktopWebLinks.layer.pipe(
    Layer.provide(
      Layer.succeed(
        ElectronWindow.ElectronWindow,
        ElectronWindow.ElectronWindow.of({
          currentMainOrFirst: Effect.succeed(Option.some(window)),
          reveal: (target: Electron.BrowserWindow) => Effect.sync(() => void revealed.push(target)),
        } as unknown as ElectronWindow.ElectronWindow["Service"]),
      ),
    ),
  );
  return { sent, threads, revealed, layer, reload };
};

describe("DesktopWebLinks", () => {
  it("treats only http and https as web links", () => {
    assert.isTrue(DesktopWebLinks.isWebLink("https://example.com/"));
    assert.isTrue(DesktopWebLinks.isWebLink("http://localhost:3000/a?b=1"));
    assert.isFalse(DesktopWebLinks.isWebLink("t3code://app/welcome"));
    assert.isFalse(DesktopWebLinks.isWebLink("mailto:hello@example.com"));
    assert.isFalse(DesktopWebLinks.isWebLink("not a url"));
  });

  it("opens HTML files the way a browser does, and nothing else by path", () => {
    assert.isTrue(DesktopWebLinks.isWebPageFile("/Users/me/report.html"));
    assert.isTrue(DesktopWebLinks.isWebPageFile("/tmp/page.HTM"));
    assert.isTrue(DesktopWebLinks.isWebPageFile("/tmp/page.xhtml"));
    assert.isFalse(DesktopWebLinks.isWebPageFile("/tmp/notes.md"));
    assert.isFalse(DesktopWebLinks.isWebPageFile("/tmp/html"));
  });

  it.effect("holds links until the renderer listens, then delivers them in order", () => {
    const { sent, revealed, layer } = makeWindow();
    return Effect.gen(function* () {
      const webLinks = yield* DesktopWebLinks.DesktopWebLinks;
      // The link that launched the app arrives before the web app has loaded.
      yield* webLinks.receive("https://example.com/first");
      yield* webLinks.receive("https://example.com/second");
      assert.deepStrictEqual(sent, []);

      yield* webLinks.setRendererReady(true);
      assert.deepStrictEqual(sent, ["https://example.com/first", "https://example.com/second"]);
      assert.strictEqual(revealed.length, 1);

      yield* webLinks.receive("https://example.com/third");
      assert.deepStrictEqual(sent.at(-1), "https://example.com/third");

      // A reloading web app stops listening; links wait for it again.
      yield* webLinks.setRendererReady(false);
      yield* webLinks.receive("https://example.com/fourth");
      assert.strictEqual(sent.length, 3);
    }).pipe(Effect.provide(layer));
  });

  it.effect("holds links that arrive while the web app reloads until it listens again", () => {
    const { sent, layer, reload } = makeWindow();
    return Effect.gen(function* () {
      const webLinks = yield* DesktopWebLinks.DesktopWebLinks;
      yield* webLinks.setRendererReady(true);
      // The old page never says it stopped; the reload itself ends its listening.
      reload();
      yield* webLinks.receive("https://example.com/during-reload");
      assert.deepStrictEqual(sent, []);

      yield* webLinks.setRendererReady(true);
      assert.deepStrictEqual(sent, ["https://example.com/during-reload"]);
    }).pipe(Effect.provide(layer));
  });

  const ENV = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
  const THREAD = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d";

  it("parses exactly t3code://threads/<environmentId>/<threadId>", () => {
    const parse = (url: string) => DesktopWebLinks.parseThreadLink(url, "t3code");
    assert.deepStrictEqual(parse(`t3code://threads/${ENV}/${THREAD}`), {
      environmentId: ENV,
      threadId: THREAD,
    });
    assert.deepStrictEqual(parse(`T3CODE://threads/${ENV.toUpperCase()}/${THREAD}`), {
      environmentId: ENV,
      threadId: THREAD,
    });
    // Imported threads carry encoded ids.
    assert.deepStrictEqual(parse(`t3code://threads/${ENV}/import%3Aclaude%3Aabc`), {
      environmentId: ENV,
      threadId: "import:claude:abc",
    });
    for (const url of [
      `t3code-dev://threads/${ENV}/${THREAD}`,
      `t3code://app/${ENV}/${THREAD}`,
      `t3code://threads/primary/${THREAD}`,
      `t3code://threads/${ENV}`,
      `t3code://threads/${ENV}/${THREAD}/extra`,
      `t3code://threads/${ENV}/${THREAD}?x=1`,
      `t3code://threads/${ENV}/${THREAD}#x`,
      `t3code://threads/${ENV}/%20`,
      `t3code://threads/${ENV}/%E0%A4%A`,
      "t3code://app/welcome",
      "https://example.com/",
    ]) {
      assert.isNull(parse(url), url);
    }
  });

  it.effect("holds the newest thread link until the renderer listens", () => {
    const { threads, revealed, layer } = makeWindow();
    return Effect.gen(function* () {
      const webLinks = yield* DesktopWebLinks.DesktopWebLinks;
      yield* webLinks.receiveThread({ environmentId: ENV, threadId: "older" });
      yield* webLinks.receiveThread({ environmentId: ENV, threadId: THREAD });
      assert.deepStrictEqual(threads, []);

      yield* webLinks.setRendererReady(true);
      assert.deepStrictEqual(threads, [{ environmentId: ENV, threadId: THREAD }]);
      assert.strictEqual(revealed.length, 1);

      // Delivered once: listening again does not replay it.
      yield* webLinks.setRendererReady(false);
      yield* webLinks.setRendererReady(true);
      assert.strictEqual(threads.length, 1);
    }).pipe(Effect.provide(layer));
  });
});
