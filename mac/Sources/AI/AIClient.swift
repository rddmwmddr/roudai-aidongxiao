import Foundation

// 调用 AI 服务。Claude 走官方 Messages 接口（Swift 没有官方 SDK，用原始 HTTP），其他服务走 OpenAI 兼容接口。
// 两边都用流式：长文稿等得久，流式才能显示进度，也不容易超时。

nonisolated enum AIError: LocalizedError, Equatable {
    case missingKey(String)
    case missingModel(String)
    case badURL(String)
    case unauthorized(String)
    case rateLimited
    case server(Int, String)
    case refused
    case truncated
    case emptyResponse
    case network(String)

    var errorDescription: String? {
        switch self {
        case .missingKey(let name): "「\(name)」还没有 API Key。到「设置 > AI」填写后再试。"
        case .missingModel(let name): "「\(name)」还没有选模型。到「设置 > AI」填写模型名后再试。"
        case .badURL(let url): "接口地址「\(url)」不正确。地址要以 https:// 开头，比如 https://api.deepseek.com/v1。"
        case .unauthorized(let name): "「\(name)」拒绝了这把 API Key。到「设置 > AI」检查 Key 和接口地址是否对应。"
        case .rateLimited: "请求太频繁，服务商暂时限流。等一分钟再试。"
        case .server(let code, let detail): "服务返回错误（\(code)）：\(detail)。检查模型名和接口地址后再试。"
        case .refused: "这段文稿被服务拒绝处理。可以换一个服务，或改用规则分镜。"
        case .truncated: "结果太长被截断了。可以把文稿分成几段生成，或换一个模型。"
        case .emptyResponse: "服务没有返回内容。换一个模型再试。"
        case .network(let detail): "网络连接失败：\(detail)。检查网络或代理后再试。"
        }
    }
}

nonisolated struct AIClient: Sendable {
    let profile: AIProfile
    let apiKey: String
    let session: URLSession

    init(profile: AIProfile, apiKey: String, session: URLSession = .shared) {
        self.profile = profile
        self.apiKey = apiKey
        self.session = session
    }

    private func url(_ path: String) throws -> URL {
        var base = profile.baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        while base.hasSuffix("/") { base.removeLast() }
        guard let u = URL(string: base + path), let scheme = u.scheme, ["https", "http"].contains(scheme), u.host() != nil else {
            throw AIError.badURL(profile.baseURL)
        }
        return u
    }

    private var isOfficialClaude: Bool {
        profile.kind == .anthropic && profile.endpointHost == "api.anthropic.com"
    }

    // ---------- 生成 ----------
    // 返回完整文本。onText 收到目前累计的字符数，界面用来显示进度
    func generate(system: String, user: String, schema: [String: Any]?, onProgress: @Sendable @escaping (Int) -> Void) async throws -> String {
        guard !profile.model.isEmpty else { throw AIError.missingModel(profile.name) }
        var attempt = 0
        while true {
            do {
                return try await once(system: system, user: user, schema: schema, onProgress: onProgress)
            } catch let e as AIError {
                // 只重试限流和服务端错误，4xx 重试没有用
                let retryable: Bool
                switch e {
                case .rateLimited: retryable = true
                case .server(let code, _): retryable = code >= 500
                case .network: retryable = true
                default: retryable = false
                }
                attempt += 1
                if !retryable || attempt >= 3 { throw e }
                try await Task.sleep(for: .seconds(Double(attempt) * 3))
            }
        }
    }

    private func once(system: String, user: String, schema: [String: Any]?, onProgress: @Sendable @escaping (Int) -> Void) async throws -> String {
        switch profile.kind {
        case .anthropic: try await claude(system: system, user: user, schema: schema, onProgress: onProgress)
        case .openAICompatible: try await openAI(system: system, user: user, schema: schema, onProgress: onProgress)
        }
    }

    private func start(_ request: URLRequest) async throws -> URLSession.AsyncBytes {
        let bytes: URLSession.AsyncBytes
        let response: URLResponse
        do {
            (bytes, response) = try await session.bytes(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch let e as URLError where e.code == .cancelled {
            throw CancellationError()
        } catch {
            throw AIError.network(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else { throw AIError.emptyResponse }
        if http.statusCode == 200 { return bytes }
        var body = Data()
        for try await b in bytes {
            body.append(b)
            if body.count > 4000 { break }
        }
        throw mapStatus(http.statusCode, body: body)
    }

    private func mapStatus(_ code: Int, body: Data) -> AIError {
        switch code {
        case 401, 403: return .unauthorized(profile.name)
        case 429: return .rateLimited
        default:
            var detail = String(decoding: body, as: UTF8.self)
            if let any = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
                if let err = any["error"] as? [String: Any], let m = err["message"] as? String { detail = m } else if let m = any["message"] as? String { detail = m }
            }
            return .server(code, String(detail.prefix(200)))
        }
    }

    // ---------- Claude ----------
    private func claudeHeaders(_ r: inout URLRequest) {
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        r.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
    }

    private func claude(system: String, user: String, schema: [String: Any]?, onProgress: @Sendable @escaping (Int) -> Void) async throws -> String {
        var r = URLRequest(url: try url("/v1/messages"))
        r.httpMethod = "POST"
        r.timeoutInterval = 600
        claudeHeaders(&r)
        var body: [String: Any] = [
            "model": profile.model,
            "max_tokens": 64000,
            "stream": true,
            "system": system,
            "messages": [["role": "user", "content": user]],
        ]
        var output: [String: Any] = ["effort": "high"]
        if let schema {
            output["format"] = ["type": "json_schema", "schema": schema]
        }
        body["output_config"] = output
        // 官方接口上开启拒绝时自动换模型重跑，第三方代理不一定认识这个字段
        if isOfficialClaude {
            r.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
            body["fallbacks"] = "default"
        }
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let bytes = try await start(r)
        var text = ""
        var stop: String?
        for try await line in bytes.lines {
            try Task.checkCancellation()
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let data = payload.data(using: .utf8), let event = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let type = event["type"] as? String else { continue }
            switch type {
            case "content_block_delta":
                if let d = event["delta"] as? [String: Any], d["type"] as? String == "text_delta", let t = d["text"] as? String {
                    text += t
                    onProgress(text.count)
                }
            case "message_delta":
                if let d = event["delta"] as? [String: Any], let s = d["stop_reason"] as? String { stop = s }
            case "error":
                let e = event["error"] as? [String: Any]
                if e?["type"] as? String == "overloaded_error" { throw AIError.server(529, "服务繁忙") }
                throw AIError.server(500, e?["message"] as? String ?? "未知错误")
            default:
                break
            }
        }
        if stop == "refusal" { throw AIError.refused }
        if stop == "max_tokens" { throw AIError.truncated }
        if text.isEmpty { throw AIError.emptyResponse }
        return text
    }

    // ---------- OpenAI 兼容 ----------
    private func openAIHeaders(_ r: inout URLRequest) {
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    }

    private func openAI(system: String, user: String, schema: [String: Any]?, onProgress: @Sendable @escaping (Int) -> Void) async throws -> String {
        var r = URLRequest(url: try url("/chat/completions"))
        r.httpMethod = "POST"
        r.timeoutInterval = 600
        openAIHeaders(&r)
        var body: [String: Any] = [
            "model": profile.model,
            "stream": true,
            "messages": [["role": "system", "content": system], ["role": "user", "content": user]],
        ]
        if schema != nil { body["response_format"] = ["type": "json_object"] }
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let bytes = try await start(r)
        var text = ""
        var finish: String?
        for try await line in bytes.lines {
            try Task.checkCancellation()
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            if payload == "[DONE]" { break }
            guard let data = payload.data(using: .utf8), let event = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
            if let err = event["error"] as? [String: Any] { throw AIError.server(500, err["message"] as? String ?? "未知错误") }
            guard let choice = (event["choices"] as? [[String: Any]])?.first else { continue }
            if let delta = choice["delta"] as? [String: Any], let t = delta["content"] as? String {
                text += t
                onProgress(text.count)
            }
            if let f = choice["finish_reason"] as? String { finish = f }
        }
        if finish == "length" { throw AIError.truncated }
        if finish == "content_filter" { throw AIError.refused }
        if text.isEmpty { throw AIError.emptyResponse }
        return text
    }

    // ---------- 测试连接与模型列表 ----------
    func listModels() async throws -> [String] {
        let path = profile.kind == .anthropic ? "/v1/models?limit=100" : "/models"
        var r = URLRequest(url: try url(path))
        r.timeoutInterval = 30
        if profile.kind == .anthropic { claudeHeaders(&r) } else { openAIHeaders(&r) }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: r)
        } catch {
            throw AIError.network(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else { throw AIError.emptyResponse }
        guard http.statusCode == 200 else { throw mapStatus(http.statusCode, body: data) }
        let any = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let list = any?["data"] as? [[String: Any]] ?? []
        return list.compactMap { $0["id"] as? String }.sorted()
    }

    // 发一条很短的消息，确认地址、Key、模型三样都对
    func testConnection() async throws -> String {
        let reply = try await once(system: "只回答「好」。", user: "连接测试", schema: nil, onProgress: { _ in })
        return String(reply.prefix(30))
    }
}
