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
        if user.startswith("新建模板："):
            repaired = "上次草稿的校验问题：" in user
            if repaired:
                assert "elements[0].color" in user
            change = {"name": "绿字标题卡", "duration": 1.2, "elements": [
                {"id": "headline", "type": "text", "x": 240, "y": 540, "text": "标题",
                 "size": 120, "color": "#84CC16" if repaired else "green", "enter": "slide"},
                {"id": "accent", "type": "rect", "x": 180, "y": 470, "width": 20, "height": 140, "color": "#FFFFFF"},
            ]}
            text = json.dumps({"change": json.dumps(change, ensure_ascii=False), "summary": "绿字从右侧入场"}, ensure_ascii=False)
        elif user.startswith("修改目标：绿字标题卡（local.ai-"):
            context = json.loads(user.split("已保存的配置和可用元素：\n", 1)[1].split("\n用户描述：", 1)[0])
            assert context["entry"]["elements"][0]["color"] == "#84CC16"
            assert context["entry"]["elements"][1]["id"] == "accent"
            change = {"elements": [{"id": "headline", "size": 150}]}
            text = json.dumps({"change": change, "summary": "标题字号加大"}, ensure_ascii=False)
        elif user.startswith("修改目标：一百根 · 自定义（local.ai-"):
            context = json.loads(user.split("已保存的配置和可用元素：\n", 1)[1].split("\n用户描述：", 1)[0])
            assert context["entry"]["overlays"][0]["text"] == "总共5000人"
            assert 'bind:"sampleSize"' in req["messages"][0]["content"]
            change = {"overlays": [{"id": "total-title", "bind": "sampleSize", "text": "总共{sampleSize}人"}]}
            text = json.dumps({"change": change, "summary": "标题跟随每镜的样本人数"}, ensure_ascii=False)
        elif user.startswith("修改目标：一百根（comb）"):
            if "总共5000人" in user:
                assert "用 overlays 叠加独立文字" in user
                change = {"overlays": [{"id": "total-title", "type": "text", "text": "总共5000人",
                                        "x": 80, "y": 60, "size": 48, "color": "#FFFFFF"}]}
                summary = "左上角加了标题"
            elif "再把速度改成两倍" in user:
                context = json.loads(user.split("已保存的配置和可用元素：\n", 1)[1].split("\n用户描述：", 1)[0])
                assert context["entry"]["defaults"]["colors"]["primary"] == "#84CC16"
                change = {"defaults": {"speed": 2}}
                summary = "速度设为两倍"
            else:
                change = {"defaults": {"colors": {"primary": "#84CC16"}}}
                summary = "主色改为绿色"
            text = json.dumps({"change": change, "summary": summary}, ensure_ascii=False)
        elif user.startswith("目标动效：split "):
            request = json.loads(user.splitlines()[2])
            data = {"left": {"title": "手冲", "lines": ["风味清爽"]}, "right": {"title": "拿铁", "lines": ["风味醇厚"]}}
            if "上次的校验结果：" not in user:
                data["left"]["lines"] = ["风味清爽，99分"]
            elif "99" not in user:
                raise AssertionError("修正请求要带上具体校验问题")
            row = {"tpl": "split", "line": request["source"]["line"], "data": json.dumps(data, ensure_ascii=False)}
            text = json.dumps({"rows": [row]}, ensure_ascii=False)
        else:
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
