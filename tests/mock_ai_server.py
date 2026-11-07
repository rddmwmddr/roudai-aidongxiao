#!/usr/bin/env python3
# 假的 AI 服务：只给测试用，同时说 OpenAI 兼容和 Claude 两种格式，流式返回。不联网，不需要真实的 Key。
#   python3 tests/mock_ai_server.py
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 18765


def rows_for(user):
    text = user.split("文稿：", 1)[-1].split("输出 JSON", 1)[0].strip()
    rows = []
    fake_done = False
    for line in [x.strip() for x in text.split("\n") if x.strip()]:
        nums = re.findall(r"(\d+(?:\.\d+)?)%", line)
        row = {"line": line, "kind": "B", "cat": "文字动效", "tpl": "statement", "visual": "假服务的画面说明", "note": "", "data": json.dumps({"lines": [line]}, ensure_ascii=False)}
        if nums and not fake_done:
            # 故意写一个原文没有的数字，看引擎拦不拦得住
            row.update({"tpl": "comb", "cat": "数据动效", "data": json.dumps({"groups": [{"title": "", "relation": "single", "metrics": [{"caption": "这个数是假服务编的", "value": 77}]}]}, ensure_ascii=False)})
            fake_done = True
        elif nums:
            row.update({"tpl": "comb", "cat": "数据动效", "data": json.dumps({"groups": [{"title": "", "relation": "single", "metrics": [{"caption": "说明", "value": float(n)} for n in nums[:2]]}]}, ensure_ascii=False)})
        rows.append(row)
    return json.dumps({"rows": rows}, ensure_ascii=False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return

    def _sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()

    def _send(self, payload):
        self.wfile.write(f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode())
        self.wfile.flush()

    def do_GET(self):
        body = json.dumps({"data": [{"id": "mock-model"}, {"id": "mock-model-2"}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        req = json.loads(self.rfile.read(size) or b"{}")
        auth = self.headers.get("Authorization", "") + self.headers.get("x-api-key", "")
        if "fake-key" not in auth:
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":{"message":"bad key"}}')
            return
        msgs = req.get("messages", [])
        user = msgs[-1]["content"] if msgs else ""
        text = rows_for(user) if "文稿：" in user else "好"
        pieces = [text[i:i + 40] for i in range(0, len(text), 40)]
        self._sse()
        if self.path.startswith("/v1/messages"):
            # Claude 要带 output_config，不能带已经废弃的参数
            assert "temperature" not in req and "thinking" not in req or req.get("thinking", {}).get("type") == "adaptive"
            for p in pieces:
                self._send({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": p}})
            self._send({"type": "message_delta", "delta": {"stop_reason": "end_turn"}})
            self._send({"type": "message_stop"})
        else:
            for p in pieces:
                self._send({"choices": [{"delta": {"content": p}}]})
            self._send({"choices": [{"delta": {}, "finish_reason": "stop"}]})
            self.wfile.write(b"data: [DONE]\n\n")


if __name__ == "__main__":
    print("假 AI 服务", PORT, flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
