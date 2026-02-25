(function () {
    'use strict';

    var P = 'WBM';
    var NS = P + '::';
    var FMT_COMMENT = NS + 'FORMAT_GUIDE';
    function SK(k) { return P + '_' + k; }

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §0  默认配置                                          ║
    // ╚═══════════════════════════════════════════════════════╝

    var FULL_ENTRY_TEMPLATE = {
        name:'',comment:'',content:'',keys:'',secondary_keys:'',
        enabled:true,constant:false,selective:true,selectiveLogic:0,
        depth:4,order:200,position:4,role:0,
        scanDepth:null,caseSensitive:null,matchWholeWords:null,
        useGroupScoring:null,automationId:'',probability:100,
        useProbability:true,group:'',groupOverride:false,groupWeight:100,
        sticky:null,cooldown:null,delay:null,
        prevent_recursion:false,delay_until_recursion:false,
        displayIndex:null,excludeRecursion:false,vectorized:false
    };

    var DEFAULT_PROMPT_ENTRIES = [
        { id:'_sys_identity', name:'核心身份', role:'system', order:10, enabled:true, builtin:true,
          content:'你是一个专业的世界设定管理助手。你的唯一职责是审查角色对话历史与当前世界书内容，识别需要记录或更新的世界设定变化，然后输出结构化的更新指令。你不参与角色扮演，不输出任何对话内容。' },
        { id:'_sys_format', name:'格式要求', role:'system', order:20, enabled:true, builtin:true,
          content:'当你判断需要更新世界设定时，请严格按以下JSON格式输出，不要附加任何额外文字：\n\n<world_update>\n[\n  {\n    "action": "update 或 create 或 delete 或 patch",\n    "entry_name": "条目名称",\n    "fields": { ... },\n    "ops": [ ... ]\n  }\n]\n</world_update>\n\n=== action 说明 ===\n\n1. create — 创建新条目\n   fields 中写完整的字段值：\n   { "content": "完整内容", "keys": "关键词", "depth": 4, "order": 200, "constant": false }\n\n2. update — 全量替换条目\n   fields 中的 content 会完全覆盖原有内容。\n   仅在需要大幅重写时使用。\n\n3. delete — 删除条目\n   只需 entry_name。\n\n4. patch — 增量更新（推荐！省token）\n   对条目内容做局部修改，不需要重写全部。\n   在 ops 数组中写操作：\n\n   内容操作（修改 content 字段）：\n   { "op": "append", "value": "追加到末尾的文本" }\n   { "op": "prepend", "value": "添加到开头的文本" }\n   { "op": "insert_after", "anchor": "锚点文本", "value": "在锚点之后插入" }\n   { "op": "insert_before", "anchor": "锚点文本", "value": "在锚点之前插入" }\n   { "op": "replace_text", "find": "原文本", "value": "新文本" }\n   { "op": "remove_text", "find": "要删除的文本" }\n\n   字段操作（修改条目元数据）：\n   { "op": "set_field", "field": "depth", "value": 3 }\n   { "op": "set_field", "field": "order", "value": 150 }\n   { "op": "set_field", "field": "enabled", "value": false }\n   { "op": "set_field", "field": "constant", "value": true }\n\n   关键词操作：\n   { "op": "add_key", "value": "新关键词" }\n   { "op": "remove_key", "value": "旧关键词" }\n   { "op": "add_secondary_key", "value": "新副关键词" }\n   { "op": "remove_secondary_key", "value": "旧副关键词" }\n\n=== 示例 ===\n\n示例1：给已有条目追加信息（最常用）\n{\n  "action": "patch",\n  "entry_name": "陈灵川",\n  "ops": [\n    { "op": "append", "value": "高三生，学生会二把手。" }\n  ]\n}\n\n示例2：替换部分文本\n{\n  "action": "patch",\n  "entry_name": "林婉儿",\n  "ops": [\n    { "op": "replace_text", "find": "炼气七层", "value": "筑基初期" },\n    { "op": "append", "value": "\\n- 最近突破了境界。" },\n    { "op": "add_key", "value": "筑基" }\n  ]\n}\n\n示例3：在指定位置后插入\n{\n  "action": "patch",\n  "entry_name": "世界观",\n  "ops": [\n    { "op": "insert_after", "anchor": "五大宗门：", "value": "\\n6. 天机阁 — 新近崛起的情报组织。" }\n  ]\n}\n\n示例4：修改条目属性\n{\n  "action": "patch",\n  "entry_name": "旧事件",\n  "ops": [\n    { "op": "set_field", "field": "enabled", "value": false },\n    { "op": "set_field", "field": "depth", "value": 2 }\n  ]\n}\n\n=== 重要规则 ===\n- 优先使用 patch 而非 update，除非需要大幅重写\n- patch 的 append 只需写新增的部分，不要重复已有内容\n- replace_text 的 find 必须与原文完全一致（区分大小写）\n- 不需要更新时只回复"无需更新"四个字\n- 不要修改 constant/selective 除非明确需要' },
        { id:'_sys_state', name:'世界书条目（含内容）', role:'system', order:30, enabled:true, builtin:true,
          content:'以下是当前世界书中所有条目的完整信息（包含内容正文）。你可以直接查看每个条目的内容来判断是否需要更新。\n\n{current_worldbook_context}' },
        { id:'_usr_trigger', name:'触发指令', role:'user', order:900, enabled:true, builtin:true,
          content:'请审查以上对话内容和当前世界书的全部条目内容。如有需要更新、新增或删除的条目，请按格式输出更新指令（优先使用 patch 进行增量更新）。如无需更新，只回复"无需更新"。' }
    ];

    var DEFAULTS = {
        config: {
            mode:'external', apiSource:'custom', targetType:'charPrimary',
            targetBookName:'', startAfter:3, interval:5, autoEnabled:true,
            reviewDepth:10, confirmDelete:true,
            confirmUpdate:false, maxCreatePerRound:10,
            contentFilterMode:'none', contentFilterTags:'',
            contextMode:'full', maxContentChars:0,
            patchDuplicateGuard:true, fabEnabled:true,
            approvalMode: 'auto',
            triggerTiming: 'after',
            syncOnDelete: false,
            snapshotRetention: 50,
            excludeConstantFromPrompt: false,
            directTriggerOnly: false,
            sendUserMessages: true,
            sendAiMessages: true,
            autoVerifyAfterUpdate: true,
            refreshMode: 'full',
            // ★ 新功能开关
            aiRegistryEnabled: true,
            chatIsolationEnabled: false,
            autoBackupBeforeAI: false,
            entryLockEnabled: false,
            tokenEstimateEnabled: false,
            activeApiPreset: '',
            activePromptPreset: ''
        },
        api: {
            type:'openai', endpoint:'', key:'', model:'gpt-4o-mini',
            maxTokens:4096, temperature:0.7, topP:0.95, timeoutMs:120000, retries:2
        },
        entryDefaults: { enabled:true, constant:false, selective:true, depth:4, order:200 }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §1  工具函数                                          ║
    // ╚═══════════════════════════════════════════════════════╝

    function _esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s == null ? '' : String(s))); return d.innerHTML; }
    function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function _safeCharBooks() {
        try {
            if (typeof getCharWorldbookNames === 'function') return getCharWorldbookNames('current');
        } catch (e) {}
        try {
            if (typeof TavernHelper !== 'undefined') {
                var primary = null;
                if (typeof TavernHelper.getCurrentCharPrimaryLorebook === 'function') {
                    primary = TavernHelper.getCurrentCharPrimaryLorebook();
                }
                var additional = [];
                if (typeof TavernHelper.getCharLorebooks === 'function') {
                    var books = TavernHelper.getCharLorebooks();
                    if (Array.isArray(books)) {
                        additional = books.filter(function (b) { return b !== primary; });
                    }
                }
                if (primary) return { primary: primary, additional: additional };
            }
        } catch (e) {}
        try {
            var ctx = _getSTContext();
            if (ctx) {
                var charData = null;
                if (ctx.characterId !== undefined && ctx.characters) charData = ctx.characters[ctx.characterId];
                if (charData) {
                    var p2 = null;
                    try { p2 = charData.data.extensions.world || null; } catch (e2) {}
                    return { primary: p2, additional: [] };
                }
            }
        } catch (e) {}
        return { primary: null, additional: [] };
    }
    function _genId() { return P + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
    function _log(m) { console.log('[' + P + '] ' + m); }
    function _warn(m) { console.warn('[' + P + '] ' + m); }
    function _err(m, e) { console.error('[' + P + '] ' + m, e || ''); }
    function _formatDate() { var d = new Date(); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
    function _escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function _previewFloors(s, i, n) {
        if (i === 0) { var f = []; for (var x = 0; x < n; x++) f.push(s + 1 + x); return f.join(', ') + ', ...'; }
        if (i < 0) return '(无效)';
        var f2 = []; for (var x2 = 0; x2 < n; x2++) f2.push(s + i * (x2 + 1)); return f2.join(', ') + ', ...';
    }

    function _getSTContext() {
        try { if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') return SillyTavern.getContext(); } catch (e) { }
        return null;
    }

    function _getChatArray() { var ctx = _getSTContext(); if (ctx && Array.isArray(ctx.chat)) return ctx.chat; return null; }

    function _getChatId() {
        try {
            var ctx = _getSTContext();
            if (ctx) {
                if (ctx.chatId) return String(ctx.chatId);
                if (ctx.getCurrentChatId) {
                    var id = ctx.getCurrentChatId();
                    if (id) return String(id);
                }
                if (ctx.chatFileName) return String(ctx.chatFileName);
                var name = ctx.name2 || ctx.characterId || '';
                if (name) return name + '_chat';
            }
        } catch (e) { }
        return null;
    }

    function _getRequestHeaders() {
        try {
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getRequestHeaders === 'function')
                return SillyTavern.getRequestHeaders();
        } catch (e) {}
        try {
            if (typeof getRequestHeaders === 'function') return getRequestHeaders();
        } catch (e) {}
        return { 'Content-Type': 'application/json' };
    }

    function _getEventSource() {
        try {
            var ctx = _getSTContext();
            if (ctx && ctx.eventSource && typeof ctx.eventSource.on === 'function') return ctx.eventSource;
        } catch (e) {}
        try {
            if (typeof eventSource !== 'undefined' && typeof eventSource.on === 'function') return eventSource;
        } catch (e) {}
        return null;
    }

    function _getEventTypes() {
        try {
            var ctx = _getSTContext();
            if (ctx && ctx.event_types) return ctx.event_types;
        } catch (e) {}
        try {
            if (typeof event_types !== 'undefined') return event_types;
        } catch (e) {}
        return {};
    }

    function _isBool(v, expect) {
        if (expect) return v === true || v === 1 || v === '1' || v === 'true';
        return v === false || v === 0 || v === '0' || v === 'false' || v === '' || v === null || v === undefined;
    }

    function _aiFloor() {
        var chat = _getChatArray();
        if (chat) { var c = 0; for (var i = 0; i < chat.length; i++) { if (!chat[i].is_user && !chat[i].is_system) c++; } return c; }
        try { var allMes = document.querySelectorAll('#chat .mes'); if (allMes && allMes.length > 0) { var cnt = 0; for (var j = 0; j < allMes.length; j++) { var attr = allMes[j].getAttribute('is_user'); if (attr !== 'true' && attr !== '1') cnt++; } return cnt; } } catch (e) { }
        return 0;
    }

    function _totalFloor() { var chat = _getChatArray(); if (chat) return chat.length; var els = document.querySelectorAll('#chat .mes'); return els ? els.length : 0; }

    function _getKeys(e) {
        if (!e) return '';
        if (e.keys && typeof e.keys === 'string' && e.keys.trim()) return e.keys.trim();
        if (Array.isArray(e.key) && e.key.length > 0) return e.key.join(',');
        if (e.key && typeof e.key === 'string' && e.key.trim()) return e.key.trim();
        if (Array.isArray(e.keys) && e.keys.length > 0) return e.keys.join(',');
        return '';
    }

    function _getSecondaryKeys(e) {
        if (!e) return '';
        if (e.secondary_keys && typeof e.secondary_keys === 'string') return e.secondary_keys.trim();
        if (Array.isArray(e.keysecondary) && e.keysecondary.length > 0) return e.keysecondary.join(',');
        if (e.keysecondary && typeof e.keysecondary === 'string') return e.keysecondary.trim();
        return '';
    }

    function _setKeys(entry, keysStr) {
        if (typeof keysStr === 'string') {
            entry.keys = keysStr;
            if (entry.key !== undefined) {
                entry.key = keysStr.split(',').map(function(k){ return k.trim(); }).filter(Boolean);
            }
        }
    }

    function _setSecondaryKeys(entry, keysStr) {
        if (typeof keysStr === 'string') {
            entry.secondary_keys = keysStr;
            if (entry.keysecondary !== undefined) {
                entry.keysecondary = keysStr.split(',').map(function(k){ return k.trim(); }).filter(Boolean);
            }
        }
    }

    function _dn(e) {
        if (!e) return '(未命名)';
        // 优先使用 name 字段
        var n = e.name ? String(e.name).trim() : '';
        // 剥离 WBM 前缀
        if (n && n.indexOf(NS) === 0) n = n.slice(NS.length);
        if (n) return n;
        // 回退到 comment
        var c = e.comment ? String(e.comment).trim() : '';
        if (c && c.indexOf(NS) === 0) c = c.slice(NS.length);
        if (c) return c;
        // 回退到首关键词
        var k = _getKeys(e);
        if (k) return k.split(',')[0].trim();
        return '(未命名)';
    }

    function _ord(e) { var o = e.order; return (o != null && !isNaN(o)) ? Number(o) : 999; }
    function _dep(e) { if (e.depth != null && !isNaN(e.depth)) return Number(e.depth); if (e.context != null && !isNaN(e.context)) return Number(e.context); return null; }

    function _isCon(e) {
        if (!e) return false;
        var v = e.constant;
        if (v === true || v === 1 || v === '1' || v === 'true' || v === 'on') return true;
        if (e.type === 'constant') return true;
        var ic = e.isConstant; if (ic === true || ic === 1) return true;
        var aa = e.alwaysActive || e.always_active; if (aa === true || aa === 1) return true;
        return false;
    }

    function _isConExplicit(f) {
        if (!f) return false;
        var v = f.constant;
        return (v === true || v === 1 || v === '1' || v === 'true' || v === 'on');
    }

    function _isOn(e) {
            if (!e) return false;
            var v = e.enabled; if (v === false || v === 0 || v === '0' || v === 'false' || v === 'off') return false;
            if (e.disable === true || e.disabled === true) return false;
            return true;
        }

        function _isNoRecursion(e) {
            if (!e) return false;
            return e.prevent_recursion === true || e.preventRecursion === true ||
                   e.excludeRecursion === true || e.delay_until_recursion === true ||
                   e.delayUntilRecursion === true;
        }

    function _sort(arr) {
        return arr.slice().sort(function (a, b) {
            var aw = _isOn(a) ? (_isCon(a) ? 3 : 2) : 1;
            var bw = _isOn(b) ? (_isCon(b) ? 3 : 2) : 1;
            if (aw !== bw) return bw - aw;
            return _ord(b) - _ord(a);
        });
    }

    function _decodeEntities(text) {
        if (!text) return '';
        return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    }

    function _stripHtml(html) {
        if (!html) return '';
        var text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
        return _decodeEntities(text).trim();
    }

    function _filterContent(rawText, mode, tagsStr) {
        if (!rawText || !mode || mode === 'none' || !tagsStr) return rawText;
        var tagNames = tagsStr.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
        if (tagNames.length === 0) return rawText;
        if (mode === 'include') {
            var collected = [];
            tagNames.forEach(function (tag) {
                var esc = _escRegex(tag);
                var re = new RegExp('<' + esc + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc + '>', 'gi');
                var m; while ((m = re.exec(rawText)) !== null) { var inner = m[1].trim(); if (inner) collected.push(inner); }
            });
            return collected.length > 0 ? collected.join('\n\n') : '';
        }
        if (mode === 'exclude') {
            var result = rawText;
            tagNames.forEach(function (tag) {
                var esc = _escRegex(tag);
                result = result.replace(new RegExp('<' + esc + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc + '>', 'gi'), '');
                result = result.replace(new RegExp('<' + esc + '\\s*/>', 'gi'), '');
            });
            return result.trim();
        }
        return rawText;
    }

    function _processMessageText(rawHtml) {
        if (!rawHtml) return '';
        var decoded = _decodeEntities(rawHtml);
        var mode = RT.cfg ? (RT.cfg.contentFilterMode || 'none') : 'none';
        var tags = RT.cfg ? (RT.cfg.contentFilterTags || '') : '';
        var filtered = _filterContent(decoded, mode, tags);
        // 只在非 include 模式下回退原文
        // include 模式过滤为空是合法结果（消息中没有匹配的标签）
        if (!filtered && decoded && mode !== 'include') filtered = decoded;
        var text = (filtered || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
        return text.trim();
    }

    function _estimateTokens(text) {
        if (!text) return 0;
        var cn = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
        var rest = text.replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
        var en = rest.split(/\s+/).filter(Boolean).length;
        return Math.ceil(cn * 1.8 + en * 1.3 + 10);
    }

    // ── ST 内存同步：TavernHelper 直接操作内存无需额外同步 ──
    async function _syncAfterWrite(bookName) {
        if (WI._backend === 'tavernHelper') {
            // TavernHelper 直接操作内存，通常无需额外同步
            // 但仍然发送事件通知，让其他监听者知道数据变更
            try {
                var es = _getEventSource();
                if (es && typeof es.emit === 'function') {
                    es.emit('worldInfoUpdated');
                }
            } catch (e) {}
            return true;
        }
        try {
            return await NativeWI._forceSTReload(bookName);
        } catch (e) {
            _warn('_syncAfterWrite 异常: ' + e.message);
            return false;
        }
    }

    // ── 聊天隔离：逻辑隔离工具 ──
    function _getChatIdShort() {
        var chatId = _getChatId();
        if (!chatId) return '';
        var hash = 0;
        for (var i = 0; i < chatId.length; i++) {
            hash = ((hash << 5) - hash + chatId.charCodeAt(i)) & 0x7fffffff;
        }
        return hash.toString(36).substring(0, 8);
    }

    function _getIsolationTag() {
        if (!RT.cfg.chatIsolationEnabled) return '';
        var short = _getChatIdShort();
        return short ? ('WBM_ISO_' + short) : '';
    }

    /**
     * 隔离过滤器
     * - 无隔离标记的条目 → 所有聊天可见（用户手动创建的、全局条目）
     * - 有当前聊天标记的条目 → 当前聊天可见
     * - 有其他聊天标记的条目 → 当前聊天不可见
     */
    function _filterByIsolation(entries) {
        if (!RT.cfg.chatIsolationEnabled) return entries;
        var tag = _getIsolationTag();
        if (!tag) return entries;
        return entries.filter(function (e) {
            var aid = e.automationId || '';
            // 没有隔离标记 → 全局可见
            if (!aid || aid.indexOf('WBM_ISO_') !== 0) return true;
            // 有隔离标记 → 仅匹配当前聊天
            return aid === tag;
        });
    }

    // ── 写入确认轮询器 ──
    function _waitForSync(bookName, checkFn, maxAttempts, intervalMs) {
        maxAttempts = maxAttempts || 5;
        intervalMs = intervalMs || 300;
        return new Promise(function (resolve) {
            var attempt = 0;
            function poll() {
                attempt++;
                try {
                    var result = checkFn();
                    if (result && typeof result.then === 'function') {
                        result.then(function (ok) {
                            if (ok || attempt >= maxAttempts) resolve(ok);
                            else setTimeout(poll, intervalMs);
                        }).catch(function () {
                            if (attempt >= maxAttempts) resolve(false);
                            else setTimeout(poll, intervalMs);
                        });
                    } else {
                        if (result || attempt >= maxAttempts) resolve(result);
                        else setTimeout(poll, intervalMs);
                    }
                } catch (e) {
                    if (attempt >= maxAttempts) resolve(false);
                    else setTimeout(poll, intervalMs);
                }
            }
            poll();
        });
    }

    // ── 并发锁 ──
    function _createLock() {
        var _locked = false;
        var _waiters = [];
        return {
            acquire: function () {
                return new Promise(function (resolve) {
                    if (!_locked) { _locked = true; resolve(); }
                    else _waiters.push(resolve);
                });
            },
            release: function () {
                if (_waiters.length > 0) {
                    var next = _waiters.shift();
                    next();
                } else {
                    _locked = false;
                }
            },
            isLocked: function () { return _locked; }
        };
    }

    // ── 安全获取聊天数组快照 ──
    function _getChatSnapshot() {
        var chat = _getChatArray();
        if (!chat) return [];
        try { return chat.slice(); } catch (e) { return []; }
    }

    // ── 强化 JSON 解析（处理 AI 输出的常见格式问题）──
    function _robustJsonParse(text) {
        if (!text) return null;
        var s = text.trim();
        // 1. 移除尾逗号
        s = s.replace(/,\s*([\]}])/g, '$1');
        // 2. 移除行注释
        s = s.replace(/\/\/[^\n]*/g, '');
        // 3. 尝试直接解析
        try { return JSON.parse(s); } catch (e) {}
        // 4. 单引号→双引号（仅在非字符串内容中替换）
        try {
            var s2 = s.replace(/'/g, '"');
            return JSON.parse(s2);
        } catch (e) {}
        // 5. 修复未转义的换行符
        try {
            var s3 = s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
            return JSON.parse(s3);
        } catch (e) {}
        return null;
    }

    // ── 页面卸载保护 ──
    var _unloadHandlers = [];
    var _unloadProtectionInited = false;
    function _registerUnloadHandler(fn) {
        _unloadHandlers.push(fn);
    }
    function _initUnloadProtection() {
        if (_unloadProtectionInited) return;
        _unloadProtectionInited = true;
        window.addEventListener('beforeunload', function () {
            for (var i = 0; i < _unloadHandlers.length; i++) {
                try { _unloadHandlers[i](); } catch (e) {}
            }
        });
    }

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §2  Toast 通知系统                                    ║
    // ╚═══════════════════════════════════════════════════════╝

    var Toast = {
        _container: null,
        _ensure: function () {
            if (this._container) return this._container;
            var c = document.createElement('div'); 
            c.id = P + '-toast-container';
            c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10010;display:flex;flex-direction:column;gap:8px;pointer-events:none';
            document.body.appendChild(c); 
            this._container = c; 
            return c;
        },
        show: function (msg, type, duration) {
            var c = this._ensure();
            var colors = { info:'#9A63D5', success:'#4caf50', warning:'#FEE1A1', error:'#f44336' };
            var bg = { info:'rgba(64,43,113,.95)', success:'rgba(30,63,47,.95)', warning:'rgba(172,118,85,.95)', error:'rgba(80,30,30,.95)' };
            var t = document.createElement('div');
            t.style.cssText = 'pointer-events:auto;padding:12px 18px;border-radius:8px;color:#e0e0e0;font-size:13px;font-family:sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);border-left:4px solid ' + (colors[type]||colors.info) + ';background:' + (bg[type]||bg.info) + ';max-width:380px;word-break:break-word;transition:all .3s;opacity:0;transform:translateX(20px)';
            t.textContent = msg; 
            c.appendChild(t);
            
            // 添加动画效果
            setTimeout(function() {
                t.style.opacity = '1';
                t.style.transform = 'translateX(0)';
            }, 10);
            
            setTimeout(function () { 
                t.style.opacity = '0'; 
                t.style.transform = 'translateX(20px)';
                setTimeout(function () { 
                    if (t.parentNode) t.parentNode.removeChild(t); 
                }, 300); 
            }, duration || 4000);
        },
        persistent: function (msg, type) {
            var c = this._ensure();
            var colors = { info:'#9A63D5', success:'#4caf50', warning:'#FEE1A1', error:'#f44336' };
            var bg = { info:'rgba(64,43,113,.95)', success:'rgba(30,63,47,.95)', warning:'rgba(172,118,85,.95)', error:'rgba(80,30,30,.95)' };
            var t = document.createElement('div');
            t.style.cssText = 'pointer-events:auto;padding:12px 18px;border-radius:8px;color:#e0e0e0;font-size:13px;font-family:sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);border-left:4px solid ' + (colors[type]||colors.info) + ';background:' + (bg[type]||bg.info) + ';max-width:380px;word-break:break-word;opacity:0;transform:translateX(20px);transition:all .3s';
            t.textContent = msg; 
            c.appendChild(t);
            
            // 添加动画效果
            setTimeout(function() {
                t.style.opacity = '1';
                t.style.transform = 'translateX(0)';
            }, 10);
            
            return {
                el: t,
                update: function (newMsg, newType) { 
                    t.textContent = newMsg; 
                    if (newType) { 
                        t.style.borderLeftColor = colors[newType]||colors.info; 
                        t.style.background = bg[newType]||bg.info; 
                    } 
                },
                close: function (delay) { 
                    setTimeout(function () { 
                        t.style.opacity = '0'; 
                        t.style.transform = 'translateX(20px)';
                        setTimeout(function () { 
                            if (t.parentNode) t.parentNode.removeChild(t); 
                        }, 300); 
                    }, delay || 0); 
                }
            };
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §3  持久化                                            ║
    // ╚═══════════════════════════════════════════════════════╝

    var Store = {
        _g: function (k, fb) { try { var r = localStorage.getItem(SK(k)); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } },
        _s: function (k, v) { try { localStorage.setItem(SK(k), JSON.stringify(v)); } catch (e) { } },
        loadConfig: function () { var s = this._g('config', {}); var r = {}; for (var k in DEFAULTS.config) r[k] = s.hasOwnProperty(k) ? s[k] : DEFAULTS.config[k]; if (s.hasOwnProperty('excludeNoRecursionFromPrompt') && !s.hasOwnProperty('directTriggerOnly')) { r.directTriggerOnly = s.excludeNoRecursionFromPrompt; } delete r.excludeNoRecursionFromPrompt; return r; },
        saveConfig: function (c) { this._s('config', c); },
        loadApi: function () { var s = this._g('api', {}); var r = {}; for (var k in DEFAULTS.api) r[k] = s.hasOwnProperty(k) ? s[k] : DEFAULTS.api[k]; return r; },
        saveApi: function (a) { this._s('api', a); },
        loadPromptEntries: function () {
            var saved = this._g('promptEntries', null);
            var defaults = JSON.parse(JSON.stringify(DEFAULT_PROMPT_ENTRIES));
            if (!Array.isArray(saved) || saved.length === 0) return defaults;
            var savedIds = {};
            saved.forEach(function (s) { if (s && s.id) savedIds[s.id] = true; });
            defaults.forEach(function (d) {
                if (d.id && !savedIds[d.id]) {
                    saved.push(d);
                }
            });
            return saved;
        },
        savePromptEntries: function (e) { this._s('promptEntries', e); },
        loadLog: function () { return this._g('log', []); },
        saveLog: function (l) { this._s('log', l.slice(-300)); },
        loadEntryDefaults: function () { var s = this._g('entryDefaults', {}); var r = {}; for (var k in DEFAULTS.entryDefaults) r[k] = s.hasOwnProperty(k) ? s[k] : DEFAULTS.entryDefaults[k]; return r; },
        saveEntryDefaults: function (d) { this._s('entryDefaults', d); },

        // ═══════════════════════════════════════
        // ★ API 预设
        // ═══════════════════════════════════════
        loadApiPresets: function () { return this._g('apiPresets', []); },
        saveApiPresets: function (list) { this._s('apiPresets', list); },

        // ═══════════════════════════════════════
        // ★ 提示词预设
        // ═══════════════════════════════════════
        loadPromptPresets: function () { return this._g('promptPresets', []); },
        savePromptPresets: function (list) { this._s('promptPresets', list); },

        // ═══════════════════════════════════════
        // ★ AI 注册表（按世界书名称隔离）
        // ═══════════════════════════════════════
        loadAIRegistry: function (bookName) {
            return this._g('aiRegistry_' + (bookName || 'default'), {});
        },
        saveAIRegistry: function (bookName, reg) {
            this._s('aiRegistry_' + (bookName || 'default'), reg);
        },

        // ═══════════════════════════════════════
        // ★ 聊天隔离映射表
        // ═══════════════════════════════════════
        loadIsolationMap: function () { return this._g('isolationMap', {}); },
        saveIsolationMap: function (map) { this._s('isolationMap', map); },

        // ═══════════════════════════════════════
        // ★ 世界书备份索引
        // ═══════════════════════════════════════
        loadBackupIndex: function () { return this._g('backupIndex', []); },
        saveBackupIndex: function (idx) { this._s('backupIndex', idx.slice(-20)); },

        // ═══════════════════════════════════════
        // ★ 日志缓冲（优化高频写入）
        // ═══════════════════════════════════════
        _logBuffer: null,
        _logFlushTimer: null,

        appendLog: function (e) {
            if (!this._logBuffer) this._logBuffer = this.loadLog();
            e.ts = Date.now();
            this._logBuffer.push(e);
            var self = this;
            if (!this._logFlushTimer) {
                this._logFlushTimer = setTimeout(function () {
                    if (self._logBuffer) self.saveLog(self._logBuffer);
                    self._logBuffer = null;
                    self._logFlushTimer = null;
                }, 2000);
            }
        },

        flushLog: function () {
            if (this._logBuffer) {
                this.saveLog(this._logBuffer);
                this._logBuffer = null;
            }
            if (this._logFlushTimer) {
                clearTimeout(this._logFlushTimer);
                this._logFlushTimer = null;
            }
        },

        // ═══════════════════════════════════════
        // ★ 条目锁定列表（按世界书名称隔离）
        // ═══════════════════════════════════════
        loadLockedEntries: function (bookName) {
            return this._g('locked_' + (bookName || 'default'), []);
        },
        saveLockedEntries: function (bookName, list) {
            this._s('locked_' + (bookName || 'default'), list);
        }
    };

    // 注册卸载保护：确保日志不丢失
    _registerUnloadHandler(function () {
        Store.flushLog();
        // 持久化审核队列最终状态
        try { PendingQueue._persist(); } catch (e) {}
        // 持久化快照
        try { SnapshotStore._persist(); } catch (e) {}
    });

    var RT = {
        cfg: null, api: null, promptEntries: null, entryDef: null,
        panelOpen: false, activeTab: 0,
        lastAiFloor: 0, lastProcessedAiFloor: 0, nextUpdateAiFloor: 0,
        formatEntryEnabled: false, processing: false,
        lastDebug: null, debugHistory: [], backendChats: [],
        depsL0: false, depsL1: false, depsL2: false, depsL3: false,
        depsMissing: { L0:[], L1:[], L2:[], L3:[] },
        lastManagedBookName: null, browsingBook: null,
        _diagDone: false, _diagData: null, _lastChatId: null
    };

    function loadRT() { RT.cfg = Store.loadConfig(); RT.api = Store.loadApi(); RT.promptEntries = Store.loadPromptEntries(); RT.entryDef = Store.loadEntryDefaults(); }

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §3.5  原生世界书 API + 代理层 + 队列 + 快照 + 事件桥      ║
    // ╚═══════════════════════════════════════════════════════╝

    /* ─── NativeWI: 通过 ST REST API 直接操作世界书文件 ─── */

    var NativeWI = {

        _loadBook: async function (bookName) {
            var endpoints = ['/api/worldinfo/get', '/getworldinfo'];
            var lastErr;
            for (var i = 0; i < endpoints.length; i++) {
                try {
                    var resp = await fetch(endpoints[i], {
                        method: 'POST',
                        headers: _getRequestHeaders(),
                        body: JSON.stringify({ name: bookName })
                    });
                    if (resp.ok) {
                        var data = await resp.json();
                        return data;
                    }
                    if (resp.status === 404) throw new Error('世界书 "' + bookName + '" 不存在');
                    lastErr = new Error('HTTP ' + resp.status);
                } catch (e) { lastErr = e; }
            }
            throw lastErr || new Error('加载世界书失败');
        },

        _saveBook: async function (bookName, data) {
            var endpoints = ['/api/worldinfo/edit', '/editworldinfo'];
            var lastErr;
            for (var i = 0; i < endpoints.length; i++) {
                try {
                    var resp = await fetch(endpoints[i], {
                        method: 'POST',
                        headers: _getRequestHeaders(),
                        body: JSON.stringify({ name: bookName, data: data })
                    });
                    if (resp.ok) return;
                    lastErr = new Error('HTTP ' + resp.status);
                } catch (e) { lastErr = e; }
            }
            throw lastErr || new Error('保存世界书失败');
        },

        _forceSTReload: async function (bookName) {
            var mode = (RT && RT.cfg) ? (RT.cfg.refreshMode || 'full') : 'full';
            if (mode === 'none') return true;

            var synced = false;

            // ── Phase 1: ST 全局重载函数 ──
            var globalFnNames = [
                'reloadWorldInfoData', 'loadWorldInfo', 'loadWorldInfoData',
                'updateWorldInfoList', 'refreshWorldInfo', 'reloadWorldInfo'
            ];
            for (var i = 0; i < globalFnNames.length; i++) {
                try {
                    var fn = window[globalFnNames[i]];
                    if (typeof fn === 'function') {
                        var r = fn(bookName);
                        if (r && typeof r.then === 'function') await r;
                        synced = true;
                        _log('_forceSTReload: window.' + globalFnNames[i] + '()');
                        break;
                    }
                } catch (e) {
                    _warn('_forceSTReload: ' + globalFnNames[i] + ' 异常: ' + e.message);
                }
            }

            // ── Phase 2: SillyTavern.getContext() 方法 ──
            if (!synced) {
                try {
                    var ctx = _getSTContext();
                    if (ctx) {
                        var ctxFnNames = ['reloadWorldInfo', 'loadWorldInfo', 'reloadWorldInfoData'];
                        for (var j = 0; j < ctxFnNames.length; j++) {
                            if (typeof ctx[ctxFnNames[j]] === 'function') {
                                var r2 = ctx[ctxFnNames[j]](bookName);
                                if (r2 && typeof r2.then === 'function') await r2;
                                synced = true;
                                _log('_forceSTReload: ctx.' + ctxFnNames[j] + '()');
                                break;
                            }
                        }
                    }
                } catch (e) {
                    _warn('_forceSTReload: context 方法异常: ' + e.message);
                }
            }

            // ── Phase 3: 直接写入 ST 内存中的世界书数据 ──
            if (!synced) {
                try {
                    var freshData = await this._loadBook(bookName);
                    if (freshData && freshData.entries) {
                        var memRef = this._findMemoryWorldInfo(bookName);
                        if (memRef) {
                            // 清空旧条目
                            var oldKeys = Object.keys(memRef);
                            for (var oi = 0; oi < oldKeys.length; oi++) delete memRef[oldKeys[oi]];
                            // 写入新数据
                            for (var nk in freshData.entries) {
                                if (freshData.entries.hasOwnProperty(nk)) {
                                    memRef[nk] = freshData.entries[nk];
                                }
                            }
                            synced = true;
                            _log('_forceSTReload: 直接写入 ST 内存世界书数据');
                        }
                    }
                } catch (e) {
                    _warn('_forceSTReload: 内存写入异常: ' + e.message);
                }
            }

            // ── Phase 4: 重读刷新服务端缓存 ──
            try {
                await fetch('/api/worldinfo/get', {
                    method: 'POST',
                    headers: _getRequestHeaders(),
                    body: JSON.stringify({ name: bookName })
                });
            } catch (e) {}

            // ── Phase 5: 事件通知 ──
            try {
                var es = _getEventSource();
                if (es && typeof es.emit === 'function') {
                    es.emit('worldInfoUpdated');
                    es.emit('WORLDINFO_UPDATED');
                }
            } catch (e) {}
            try {
                if (typeof jQuery !== 'undefined') jQuery(document).trigger('worldInfoUpdated');
            } catch (e) {}

            // ── Phase 6: full 模式激进刷新 ──
            if (mode === 'full') {
                try {
                    if (typeof jQuery !== 'undefined') {
                        jQuery('#world_info').trigger('change');
                        jQuery('#world_editor_select').trigger('change');
                    }
                } catch (e) {}
                try {
                    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
                } catch (e) {}
            }

            // ── Phase 7: 验证同步 ──
            if (synced) {
                var self = this;
                await _waitForSync(bookName, async function () {
                    try {
                        var check = await self._loadBook(bookName);
                        return !!(check && check.entries);
                    } catch (e) { return false; }
                }, 3, 200);
            }

            if (!synced) {
                _warn('_forceSTReload: 未能直接同步 ST 内存。数据已保存到磁盘，ST 将在下次读取时获取最新数据。');
            }

            return synced;
        },

        // 深度搜索 ST 内存中的世界书 entries 引用
        _findMemoryWorldInfo: function (bookName) {
            var candidates = [];

            // 路径1: window.world_info_data
            try {
                if (typeof window.world_info_data !== 'undefined' && window.world_info_data) {
                    var wid = window.world_info_data;
                    if (wid.entries) candidates.push(wid.entries);
                }
            } catch (e) {}

            // 路径2: SillyTavern.getContext().worldInfo
            try {
                var ctx = _getSTContext();
                if (ctx) {
                    if (ctx.worldInfo && ctx.worldInfo.entries) candidates.push(ctx.worldInfo.entries);
                    // 路径3: 角色绑定世界书
                    if (ctx.characters && ctx.characterId !== undefined) {
                        var charData = ctx.characters[ctx.characterId];
                        if (charData && charData.data && charData.data.extensions) {
                            var charWI = charData.data.extensions.world_info;
                            if (charWI && charWI.entries) candidates.push(charWI.entries);
                        }
                    }
                    // 路径4: 聊天附属世界书
                    if (ctx.chat_metadata && ctx.chat_metadata.world_info_data) {
                        var chatWI = ctx.chat_metadata.world_info_data;
                        if (chatWI.entries) candidates.push(chatWI.entries);
                    }
                }
            } catch (e) {}

            // 路径5: 全局世界书数组
            try {
                if (typeof window.world_info !== 'undefined' && Array.isArray(window.world_info)) {
                    for (var i = 0; i < window.world_info.length; i++) {
                        var wi = window.world_info[i];
                        if (wi && wi.entries && (wi.name === bookName || !bookName)) {
                            candidates.push(wi.entries);
                        }
                    }
                }
            } catch (e) {}

            // 路径6: jQuery 数据存储
            try {
                if (typeof jQuery !== 'undefined') {
                    var editorData = jQuery('#world_editor').data('worldInfo');
                    if (editorData && editorData.entries) candidates.push(editorData.entries);
                }
            } catch (e) {}

            // 返回第一个找到的有效引用
            for (var ci = 0; ci < candidates.length; ci++) {
                if (candidates[ci] && typeof candidates[ci] === 'object') {
                    return candidates[ci];
                }
            }

            return null;
        },

        createBook: async function (bookName) {
            var resp = await fetch('/api/worldinfo/create', {
                method: 'POST',
                headers: _getRequestHeaders(),
                body: JSON.stringify({ name: bookName })
            });
            if (!resp.ok) throw new Error('创建世界书失败: HTTP ' + resp.status);
        },

        getLorebookEntries: async function (bookName) {
            var data = await this._loadBook(bookName);
            if (!data || !data.entries) return [];
            var arr = [];
            for (var k in data.entries) {
                if (!data.entries.hasOwnProperty(k)) continue;
                var e = data.entries[k];
                if (e.uid == null) e.uid = parseInt(k) || k;
                if (!e.name && e.comment) e.name = e.comment;
                if (!e.keys && Array.isArray(e.key)) e.keys = e.key.join(',');
                if (!e.secondary_keys && Array.isArray(e.keysecondary)) e.secondary_keys = e.keysecondary.join(',');
                if (e.enabled === undefined) e.enabled = !e.disable;
                if (e.preventRecursion !== undefined && e.prevent_recursion === undefined) e.prevent_recursion = e.preventRecursion;
                if (e.delayUntilRecursion !== undefined && e.delay_until_recursion === undefined) e.delay_until_recursion = e.delayUntilRecursion;
                arr.push(e);
            }
            return arr;
        },

        addLorebookEntry: async function (bookName, entry) {
            var data = await this._loadBook(bookName);
            if (!data.entries) data.entries = {};
            var maxUid = -1;
            for (var k in data.entries) {
                var u = data.entries[k].uid;
                if (u != null && Number(u) > maxUid) maxUid = Number(u);
            }
            var newUid = maxUid + 1;
            var stEntry = this._toSTFormat(entry, newUid);
            data.entries[String(newUid)] = stEntry;
            if (data.originalData) {
                if (!data.originalData.entries) data.originalData.entries = {};
                data.originalData.entries[String(newUid)] = JSON.parse(JSON.stringify(stEntry));
            }
            await this._saveBook(bookName, data);
            return stEntry;
        },

        updateLorebookEntry: async function (bookName, entry) {
            var data = await this._loadBook(bookName);
            if (!data || !data.entries) throw new Error('世界书不存在');
            var uid = entry.uid != null ? entry.uid : entry.id;
            if (uid == null) throw new Error('条目缺少 uid');
            var targetKey = null;
            for (var k in data.entries) {
                if (String(data.entries[k].uid) === String(uid)) { targetKey = k; break; }
            }
            if (targetKey === null) throw new Error('未找到 uid=' + uid);
            var stEntry = this._toSTFormat(entry, Number(uid));
            var existing = data.entries[targetKey];
            for (var f in stEntry) existing[f] = stEntry[f];
            if (data.originalData && data.originalData.entries) {
                if (data.originalData.entries[targetKey]) {
                    for (var f2 in stEntry) data.originalData.entries[targetKey][f2] = stEntry[f2];
                } else {
                    data.originalData.entries[targetKey] = JSON.parse(JSON.stringify(existing));
                }
            }
            await this._saveBook(bookName, data);
        },

        deleteLorebookEntry: async function (bookName, uid) {
            var data = await this._loadBook(bookName);
            if (!data || !data.entries) throw new Error('世界书不存在');
            var targetKey = null;
            for (var k in data.entries) {
                if (String(data.entries[k].uid) === String(uid)) { targetKey = k; break; }
            }
            if (targetKey === null) throw new Error('未找到 uid=' + uid);
            delete data.entries[targetKey];
            if (data.originalData && data.originalData.entries) delete data.originalData.entries[targetKey];
            await this._saveBook(bookName, data);
        },

        _toSTFormat: function (entry, uid) {
            var st = { uid: uid };
            st.name = entry.name || entry.comment || '';

            if (typeof entry.keys === 'string') {
                st.key = entry.keys.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
            } else if (Array.isArray(entry.key)) { st.key = entry.key.slice(); }
            else { st.key = []; }

            if (typeof entry.secondary_keys === 'string') {
                st.keysecondary = entry.secondary_keys.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
            } else if (Array.isArray(entry.keysecondary)) { st.keysecondary = entry.keysecondary.slice(); }
            else { st.keysecondary = []; }

            st.comment = entry.comment || entry.name || '';
            st.content = entry.content || '';
            if (entry.enabled !== undefined) st.disable = !entry.enabled;
            else if (entry.disable !== undefined) st.disable = !!entry.disable;
            else st.disable = false;

            var direct = ['constant','selective','selectiveLogic','order','position','role','depth',
                'scanDepth','caseSensitive','matchWholeWords','useGroupScoring','automationId',
                'probability','useProbability','group','groupOverride','groupWeight',
                'sticky','cooldown','delay','displayIndex','excludeRecursion','vectorized','addMemo'];
            for (var i = 0; i < direct.length; i++) {
                if (entry[direct[i]] !== undefined) st[direct[i]] = entry[direct[i]];
            }
            if (entry.prevent_recursion !== undefined) st.preventRecursion = entry.prevent_recursion;
            if (entry.preventRecursion !== undefined) st.preventRecursion = entry.preventRecursion;
            if (entry.delay_until_recursion !== undefined) st.delayUntilRecursion = entry.delay_until_recursion;
            if (entry.delayUntilRecursion !== undefined) st.delayUntilRecursion = entry.delayUntilRecursion;
            return st;
        },

        getGlobalBookNames: function () {
            try { if (typeof getGlobalWorldbookNames === 'function') return getGlobalWorldbookNames(); } catch (e) {}
            try {
                var sel = document.querySelector('#world_info');
                if (sel) {
                    var names = [];
                    for (var i = 0; i < sel.options.length; i++) {
                        var v = sel.options[i].value;
                        if (v && v !== 'None' && v !== '') names.push(v);
                    }
                    if (names.length > 0) return names;
                }
            } catch (e) {}
            return [];
        },

        getChatBookName: function () {
            try { if (typeof getChatWorldbookName === 'function') return getChatWorldbookName('current'); } catch (e) {}
            try {
                var ctx = _getSTContext();
                if (ctx && ctx.chat_metadata && ctx.chat_metadata.world_info) return ctx.chat_metadata.world_info;
            } catch (e) {}
            return null;
        }
    };

    /* ─── WI: 统一代理层 (优先 TavernHelper → 回退 NativeWI) ─── */

    var WI = {
        _backend: 'native',
        _initAttempts: 0,

        init: function () {
            this._detectBackend();
            this._initAttempts++;
        },

        _detectBackend: function () {
            var hasTH = false;
            try {
                hasTH = (typeof TavernHelper !== 'undefined' &&
                    typeof TavernHelper.getLorebookEntries === 'function' &&
                    typeof TavernHelper.createLorebookEntries === 'function' &&
                    typeof TavernHelper.setLorebookEntries === 'function' &&
                    typeof TavernHelper.deleteLorebookEntry === 'function');
            } catch (e) {}

            var newBackend = hasTH ? 'tavernHelper' : 'native';
            if (newBackend !== this._backend || this._initAttempts === 0) {
                this._backend = newBackend;
                _log('WI 后端: ' + (newBackend === 'tavernHelper' ? 'TavernHelper（内存级操作）' : '原生 REST API'));
            }
        },

        _stopReinit: function () {},

        reinit: function () {
            var old = this._backend;
            this._detectBackend();
            if (old !== this._backend) _log('WI 后端切换: ' + old + ' → ' + this._backend);
        },

        /**
         * WBM 内部格式 → TavernHelper 格式
         */
        _toTH: function (entry) {
            var th = {};

            if (entry.uid != null) th.uid = entry.uid;
            else if (entry.id != null) th.uid = entry.id;

            // comment 是 TavernHelper 的主标识符
            th.comment = entry.comment || entry.name || '';
            th.content = entry.content || '';

            // keys 必须是数组
            if (typeof entry.keys === 'string') {
                th.keys = entry.keys.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
            } else if (Array.isArray(entry.keys)) {
                th.keys = entry.keys.slice();
            } else if (Array.isArray(entry.key)) {
                th.keys = entry.key.slice();
            } else {
                th.keys = [];
            }

            // secondary_keys
            if (typeof entry.secondary_keys === 'string') {
                th.secondary_keys = entry.secondary_keys.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
            } else if (Array.isArray(entry.secondary_keys)) {
                th.secondary_keys = entry.secondary_keys.slice();
            } else if (Array.isArray(entry.keysecondary)) {
                th.secondary_keys = entry.keysecondary.slice();
            }

            // type 字段：TavernHelper 用 type 而非 constant/selective
            if (_isConExplicit(entry) || entry.type === 'constant') {
                th.type = 'constant';
            } else if (entry.type) {
                th.type = entry.type;
            } else {
                th.type = entry.selective !== false ? 'selective' : 'selective';
            }

            th.enabled = entry.enabled !== false;

            // 数值字段
            if (entry.order != null) th.order = Number(entry.order);
            if (entry.position != null) th.position = Number(entry.position);
            if (entry.depth != null) th.depth = Number(entry.depth);
            if (entry.role != null) th.role = Number(entry.role);

            // 递归控制
            if (entry.prevent_recursion === true || entry.preventRecursion === true) th.prevent_recursion = true;
            if (entry.delay_until_recursion === true || entry.delayUntilRecursion === true) th.delay_until_recursion = true;
            if (entry.excludeRecursion === true) th.excludeRecursion = true;

            // 可选字段（仅非空时传递）
            var optionals = ['probability', 'useProbability', 'selectiveLogic',
                'group', 'groupWeight', 'groupOverride', 'useGroupScoring',
                'sticky', 'cooldown', 'delay',
                'scanDepth', 'caseSensitive', 'matchWholeWords',
                'vectorized', 'automationId', 'displayIndex'];
            for (var i = 0; i < optionals.length; i++) {
                var k = optionals[i];
                if (entry[k] != null) th[k] = entry[k];
            }

            return th;
        },

        /**
         * TavernHelper 返回格式 → WBM 内部格式（标准化）
         */
        _fromTH: function (entry) {
            if (!entry) return entry;

            // ── 名称标准化：确保 name 是干净的显示名 ──
            var rawName = entry.name ? String(entry.name).trim() : '';
            var rawComment = entry.comment ? String(entry.comment).trim() : '';

            // 如果 name 带有 WBM 前缀，剥离它
            if (rawName && rawName.indexOf(NS) === 0) {
                rawName = rawName.slice(NS.length);
            }

            if (rawName) {
                entry.name = rawName;
            } else if (rawComment) {
                // name 为空，从 comment 提取
                entry.name = rawComment.indexOf(NS) === 0 ? rawComment.slice(NS.length) : rawComment;
            }

            // ── UID 标准化 ──
            if (entry.uid == null && entry.id != null) entry.uid = entry.id;

            // ── enabled 标准化 ──
            if (entry.enabled === undefined) {
                entry.enabled = (entry.disable !== true && entry.disabled !== true);
            }

            // ── type → constant/selective 标准化（供 WBM 内部函数使用）──
            if (entry.type === 'constant') {
                entry.constant = true;
                entry.selective = false;
            } else {
                entry.constant = false;
                entry.selective = true;
            }

            // ── keys 标准化 ──
            if (Array.isArray(entry.keys)) {
                entry.key = entry.keys;
            } else if (typeof entry.keys === 'string') {
                entry.key = entry.keys.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
                entry.keys = entry.key;
            }

            if (Array.isArray(entry.secondary_keys)) {
                entry.keysecondary = entry.secondary_keys;
            }

            // ── depth/context 同步 ──
            if (entry.depth != null) entry.context = entry.depth;
            else if (entry.context != null) entry.depth = entry.context;

            return entry;
        },

        getLorebookEntries: async function (bk) {
            if (this._backend === 'tavernHelper') {
                var raw = await TavernHelper.getLorebookEntries(bk);
                if (!Array.isArray(raw)) return [];
                var self = this;
                return raw.map(function (e) { return self._fromTH(e); });
            }
            return await NativeWI.getLorebookEntries(bk);
        },

        addLorebookEntry: async function (bk, entry) {
            if (this._backend === 'tavernHelper') {
                var th = this._toTH(entry);
                var result = await TavernHelper.createLorebookEntries(bk, [th]);
                return result;
            }
            return await NativeWI.addLorebookEntry(bk, entry);
        },

        updateLorebookEntry: async function (bk, entry) {
            if (this._backend === 'tavernHelper') {
                var th = this._toTH(entry);
                if (th.uid == null) throw new Error('updateLorebookEntry: 缺少 uid');
                await TavernHelper.setLorebookEntries(bk, [th]);
                return;
            }
            await NativeWI.updateLorebookEntry(bk, entry);
        },

        deleteLorebookEntry: async function (bk, uid) {
            if (this._backend === 'tavernHelper') {
                await TavernHelper.deleteLorebookEntry(bk, uid);
                return;
            }
            await NativeWI.deleteLorebookEntry(bk, uid);
        },

        createBook: async function (name) {
            if (this._backend === 'tavernHelper' && typeof TavernHelper.createLorebook === 'function') {
                return await TavernHelper.createLorebook(name);
            }
            return await NativeWI.createBook(name);
        },

        generateRaw: async function (params) {
            if (typeof TavernHelper !== 'undefined' && typeof TavernHelper.generateRaw === 'function')
                return await TavernHelper.generateRaw(params);
            throw new Error('generateRaw 不可用，请使用外部 API 模式');
        },

        getBackendType: function () { return this._backend; }
    };

    /* ─── PendingQueue: 审核队列 ─── */

    var PendingQueue = {
        _queue: [],

        _persist: function () {
            try {
                // ★ 只持久化 pending 状态的条目，避免 localStorage 膨胀
                var toSave = this._queue.filter(function (q) { return q.status === 'pending'; });
                Store._s('pendingQueue', toSave);
            } catch (e) {}
        },

        _restore: function () {
            var saved = Store._g('pendingQueue', []);
            if (Array.isArray(saved)) {
                this._queue = saved.filter(function (q) { return q && q.status === 'pending'; });
            }
        },

        add: function (cmds, floor, bookName, reply) {
            var item = {
                id: _genId(), floor: floor, bookName: bookName,
                commands: cmds, reply: reply || '',
                timestamp: Date.now(), status: 'pending'
            };
            this._queue.push(item);
            this._persist();
            _log('PendingQueue: 入队 ' + cmds.length + ' 条指令 (floor=' + floor + ')');
            return item;
        },

        getPending: function () {
            return this._queue.filter(function (q) { return q.status === 'pending'; });
        },

        count: function () { return this.getPending().length; },

        approve: async function (id) {
            var item = this._find(id);
            if (!item || item.status !== 'pending') return null;
            item.status = 'executing';
            this._persist();
            try {
                var res = await Router.execute(item.commands, item.bookName, { isManual: true, skipApproval: true, floor: item.floor });
                item.status = 'executed';
                item.results = res;
                this._persist();
                Toast.show('✅ 已批准并执行 ' + res.length + ' 条指令', 'success');
                return res;
            } catch (e) {
                item.status = 'error';
                item.error = e.message;
                this._persist();
                Toast.show('❌ 执行失败: ' + e.message, 'error');
                return null;
            }
        },

        approveOne: async function (id, cmdIndex) {
            var item = this._find(id);
            if (!item || item.status !== 'pending') return null;
            if (cmdIndex < 0 || cmdIndex >= item.commands.length) return null;
            var singleCmd = [item.commands[cmdIndex]];
            try {
                var res = await Router.execute(singleCmd, item.bookName, { isManual: true, skipApproval: true, floor: item.floor });
                item.commands.splice(cmdIndex, 1);
                if (item.commands.length === 0) item.status = 'executed';
                this._persist();
                return res;
            } catch (e) {
                Toast.show('❌ 执行失败: ' + e.message, 'error');
                return null;
            }
        },

        approveAll: async function () {
            var pending = this.getPending();
            var total = 0;
            for (var i = 0; i < pending.length; i++) {
                var r = await this.approve(pending[i].id);
                if (r) total += r.length;
            }
            if (total > 0) Toast.show('✅ 全部批准，共 ' + total + ' 条指令', 'success');
            return total;
        },

        reject: function (id) {
            var item = this._find(id);
            if (!item || item.status !== 'pending') return false;
            item.status = 'rejected';
            this._persist();
            Store.appendLog({ floor: item.floor, action: 'reject', name: '审核拒绝', status: 'skipped', reason: '用户拒绝 ' + item.commands.length + ' 条' });
            return true;
        },

        rejectAll: function () {
            var pending = this.getPending();
            var cnt = 0;
            pending.forEach(function (q) { q.status = 'rejected'; cnt++; });
            if (cnt > 0) {
                this._persist();
                Toast.show('已拒绝 ' + cnt + ' 批指令', 'info');
            }
        },

        // ★ 重命名原 clear → cleanup（清理已完成/已拒绝的条目）
        cleanup: function () {
            this._queue = this._queue.filter(function (q) { return q.status === 'pending'; });
            this._persist();
        },

        // ★ 新增：真正清空所有条目
        clearAll: function () {
            this._queue = [];
            this._persist();
        },

        getAll: function () { return this._queue.slice(); },

        _find: function (id) {
            for (var i = 0; i < this._queue.length; i++) {
                if (this._queue[i].id === id) return this._queue[i];
            }
            return null;
        }
    };

    /* ─── SnapshotStore: 操作快照（用于消息删除回滚） ─── */

    var SnapshotStore = {
        _snapshots: [],

        // ★ 新增持久化方法
        _persist: function () {
            try {
                var max = (RT.cfg && RT.cfg.snapshotRetention) || 50;
                while (this._snapshots.length > max) this._snapshots.shift();
                Store._s('snapshots', this._snapshots);
            } catch (e) {}
        },

        // ★ 新增恢复方法
        _restore: function () {
            var saved = Store._g('snapshots', []);
            if (Array.isArray(saved)) {
                this._snapshots = saved.filter(function (s) { return s && !s.rolledBack; });
            }
        },

        save: function (floor, chatId, bookName, operations) {
            this._snapshots.push({
                floor: floor,
                chatId: chatId,
                bookName: bookName,
                timestamp: Date.now(),
                operations: operations,
                rolledBack: false
            });
            var max = (RT.cfg && RT.cfg.snapshotRetention) || 50;
            while (this._snapshots.length > max) this._snapshots.shift();
            this._persist(); // ★ 写入 localStorage
        },

        getForFloor: function (floor, chatId) {
            return this._snapshots.filter(function (s) {
                return s.floor === floor && (!chatId || s.chatId === chatId) && !s.rolledBack;
            });
        },

        rollback: async function (floor, chatId) {
            var snaps = this.getForFloor(floor, chatId);
            if (snaps.length === 0) { _log('SnapshotStore: floor=' + floor + ' 无快照'); return { rolled: 0 }; }
            var rolled = 0;
            for (var si = snaps.length - 1; si >= 0; si--) {
                var snap = snaps[si];
                var bk = snap.bookName;
                for (var oi = snap.operations.length - 1; oi >= 0; oi--) {
                    var op = snap.operations[oi];
                    try {
                        if (op.action === 'create' && op.afterUid != null) {
                            await WI.deleteLorebookEntry(bk, op.afterUid);
                            rolled++;
                        } else if (op.action === 'delete' && op.before) {
                            await WI.addLorebookEntry(bk, op.before);
                            rolled++;
                        } else if ((op.action === 'update' || op.action === 'patch') && op.before) {
                            var entries = await WI.getLorebookEntries(bk);
                            var cur = Search.exact(entries, op.entry_name);
                            if (cur) {
                                var restored = JSON.parse(JSON.stringify(op.before));
                                restored.uid = cur.uid; restored.id = cur.id;
                                await WI.updateLorebookEntry(bk, restored);
                                rolled++;
                            }
                        }
                    } catch (e) { _warn('回滚失败 ' + op.entry_name + ': ' + e.message); }
                }
                snap.rolledBack = true;
            }
            this._persist(); // ★ 持久化回滚状态
            _log('SnapshotStore: floor=' + floor + ' 回滚 ' + rolled + ' 条操作');
            return { rolled: rolled };
        },

        /** 当消息被删除、楼层号整体偏移时调用 */
        adjustFloors: function (deletedFloor) {
            this._snapshots.forEach(function (s) {
                if (s.floor > deletedFloor) s.floor--;
            });
            this._persist(); // ★ 持久化楼层调整
        }
    };

    /* ─── AIRegistry: AI 生成条目追踪 ─── */

    var AIRegistry = {
        _cache: {},
        _NS_AI: NS + 'AI::',

        _load: function (bookName) {
            if (!bookName) return {};
            if (this._cache[bookName]) return this._cache[bookName];
            var reg = Store.loadAIRegistry(bookName);
            this._cache[bookName] = reg;
            return reg;
        },

        _save: function (bookName) {
            if (!bookName || !this._cache[bookName]) return;
            Store.saveAIRegistry(bookName, this._cache[bookName]);
        },

        /**
         * 追踪 AI 对条目的操作
         */
        track: function (bookName, entryName, action, floor, detail) {
            if (!RT.cfg.aiRegistryEnabled) return;
            var reg = this._load(bookName);
            if (!reg[entryName]) {
                reg[entryName] = {
                    createdAt: Date.now(),
                    createdFloor: floor,
                    lastModifiedAt: Date.now(),
                    lastModifiedFloor: floor,
                    originalAction: action,
                    managed: true,
                    history: []
                };
            }
            reg[entryName].lastModifiedAt = Date.now();
            reg[entryName].lastModifiedFloor = floor;
            reg[entryName].history.push({
                floor: floor,
                action: action,
                timestamp: Date.now(),
                detail: detail || ''
            });
            // 限制历史长度
            if (reg[entryName].history.length > 100) {
                reg[entryName].history = reg[entryName].history.slice(-100);
            }
            this._cache[bookName] = reg;
            this._save(bookName);
        },

        /**
         * 检查条目是否由 AI 管理
         */
        isAIManaged: function (bookName, entryName) {
            var reg = this._load(bookName);
            return !!(reg[entryName] && reg[entryName].managed !== false);
        },

        /**
         * 获取所有 AI 管理的条目名称
         */
        getManagedNames: function (bookName) {
            var reg = this._load(bookName);
            var names = [];
            for (var name in reg) {
                if (reg.hasOwnProperty(name) && reg[name].managed !== false) {
                    names.push(name);
                }
            }
            return names;
        },

        /**
         * 获取条目的完整追踪信息
         */
        getInfo: function (bookName, entryName) {
            var reg = this._load(bookName);
            return reg[entryName] || null;
        },

        /**
         * 标记条目为"手动接管"（不再追踪）
         */
        unmanage: function (bookName, entryName) {
            var reg = this._load(bookName);
            if (reg[entryName]) {
                reg[entryName].managed = false;
                this._save(bookName);
            }
        },

        /**
         * 重新纳入追踪
         */
        remanage: function (bookName, entryName) {
            var reg = this._load(bookName);
            if (reg[entryName]) {
                reg[entryName].managed = true;
                this._save(bookName);
            }
        },

        /**
         * 条目重命名时同步更新注册表
         */
        rename: function (bookName, oldName, newName) {
            var reg = this._load(bookName);
            if (reg[oldName]) {
                reg[newName] = reg[oldName];
                delete reg[oldName];
                this._save(bookName);
            }
        },

        /**
         * 标记条目为已删除
         */
        markDeleted: function (bookName, entryName) {
            var reg = this._load(bookName);
            if (reg[entryName]) {
                reg[entryName].managed = false;
                reg[entryName].deletedAt = Date.now();
                reg[entryName].history.push({
                    floor: RT.lastAiFloor,
                    action: 'deleted',
                    timestamp: Date.now(),
                    detail: '条目已删除'
                });
                this._save(bookName);
            }
        },

        /**
         * 批量操作：禁用所有 AI 管理的条目
         */
        disableAll: async function (bookName) {
            var names = this.getManagedNames(bookName);
            if (names.length === 0) return 0;
            var entries = await Book.getEntries(bookName);
            var count = 0;
            for (var i = 0; i < names.length; i++) {
                var target = Search.exact(entries, names[i]);
                if (target && _isOn(target)) {
                    var u = {}; for (var k in target) u[k] = target[k];
                    u.enabled = false;
                    try {
                        await Book.updateEntry(bookName, u);
                        count++;
                    } catch (e) { _warn('AIRegistry.disableAll: ' + names[i] + ' 失败: ' + e.message); }
                }
            }
            if (count > 0) {
                await _syncAfterWrite(bookName);
            }
            return count;
        },

        /**
         * 批量操作：启用所有 AI 管理的条目
         */
        enableAll: async function (bookName) {
            var names = this.getManagedNames(bookName);
            if (names.length === 0) return 0;
            var entries = await Book.getEntries(bookName);
            var count = 0;
            for (var i = 0; i < names.length; i++) {
                var target = Search.exact(entries, names[i]);
                if (target && !_isOn(target)) {
                    var u = {}; for (var k in target) u[k] = target[k];
                    u.enabled = true;
                    try {
                        await Book.updateEntry(bookName, u);
                        count++;
                    } catch (e) { _warn('AIRegistry.enableAll: ' + names[i] + ' 失败: ' + e.message); }
                }
            }
            if (count > 0) {
                await _syncAfterWrite(bookName);
            }
            return count;
        },

        /**
         * 批量操作：删除所有 AI 管理的条目
         */
        deleteAll: async function (bookName) {
            var names = this.getManagedNames(bookName);
            if (names.length === 0) return 0;
            var entries = await Book.getEntries(bookName);
            var count = 0;
            for (var i = 0; i < names.length; i++) {
                var target = Search.exact(entries, names[i]);
                if (target) {
                    var uid = Book.uid(target);
                    if (uid) {
                        try {
                            await Book.deleteEntry(bookName, uid);
                            this.markDeleted(bookName, names[i]);
                            count++;
                        } catch (e) { _warn('AIRegistry.deleteAll: ' + names[i] + ' 失败: ' + e.message); }
                    }
                }
            }
            if (count > 0) {
                await _syncAfterWrite(bookName);
            }
            return count;
        },

        /**
         * 获取完整的注册表摘要（用于 UI 显示）
         */
        getSummary: function (bookName) {
            var reg = this._load(bookName);
            var managed = 0, unmanaged = 0, deleted = 0, total = 0;
            for (var name in reg) {
                if (!reg.hasOwnProperty(name)) continue;
                total++;
                if (reg[name].deletedAt) deleted++;
                else if (reg[name].managed !== false) managed++;
                else unmanaged++;
            }
            return { managed: managed, unmanaged: unmanaged, deleted: deleted, total: total };
        },

        /**
         * 清空注册表
         */
        clearAll: function (bookName) {
            this._cache[bookName] = {};
            this._save(bookName);
        }
    };

    /* ─── ChatIsolation: 聊天级世界书隔离 ─── */

    var ChatIsolation = {

        /**
         * 获取当前聊天的隔离标记
         */
        getTag: function () {
            return _getIsolationTag();
        },

        /**
         * 获取当前隔离信息
         */
        getCurrentInfo: function () {
            if (!RT.cfg.chatIsolationEnabled) return null;
            var chatId = _getChatId();
            var tag = _getIsolationTag();
            return { chatId: chatId, tag: tag, enabled: true };
        },

        /**
         * 获取隔离统计
         */
        getStats: async function (bookName) {
            if (!bookName) return null;
            var allEntries = await Book.getEntries(bookName, true);
            var tag = _getIsolationTag();
            var myCount = 0, otherCount = 0, globalCount = 0;
            allEntries.forEach(function (e) {
                var aid = e.automationId || '';
                if (!aid || aid.indexOf('WBM_ISO_') !== 0) {
                    globalCount++;
                } else if (aid === tag) {
                    myCount++;
                } else {
                    otherCount++;
                }
            });
            return { mine: myCount, others: otherCount, global: globalCount, total: allEntries.length };
        },

        /**
         * 清理当前聊天创建的所有隔离条目
         */
        clearMine: async function (bookName) {
            if (!bookName) return 0;
            var tag = _getIsolationTag();
            if (!tag) return 0;
            var allEntries = await Book.getEntries(bookName, true);
            var count = 0;
            for (var i = 0; i < allEntries.length; i++) {
                var e = allEntries[i];
                if ((e.automationId || '') === tag) {
                    try {
                        await Book.deleteEntry(bookName, Book.uid(e));
                        count++;
                    } catch (err) { _warn('清理隔离条目失败: ' + err.message); }
                }
            }
            if (count > 0) await _syncAfterWrite(bookName);
            return count;
        },

        /**
         * 清理所有聊天的隔离条目
         */
        clearAll: async function (bookName) {
            if (!bookName) return 0;
            var allEntries = await Book.getEntries(bookName, true);
            var count = 0;
            for (var i = 0; i < allEntries.length; i++) {
                var e = allEntries[i];
                var aid = e.automationId || '';
                if (aid.indexOf('WBM_ISO_') === 0) {
                    try {
                        await Book.deleteEntry(bookName, Book.uid(e));
                        count++;
                    } catch (err) { _warn('清理隔离条目失败: ' + err.message); }
                }
            }
            if (count > 0) await _syncAfterWrite(bookName);
            return count;
        },

        /**
         * 将当前聊天的隔离条目提升为全局条目（移除隔离标记）
         */
        promoteToGlobal: async function (bookName) {
            if (!bookName) return 0;
            var tag = _getIsolationTag();
            if (!tag) return 0;
            var allEntries = await Book.getEntries(bookName, true);
            var count = 0;
            for (var i = 0; i < allEntries.length; i++) {
                var e = allEntries[i];
                if ((e.automationId || '') === tag) {
                    var u = {}; for (var k in e) u[k] = e[k];
                    u.automationId = '';
                    try {
                        await Book.updateEntry(bookName, u);
                        count++;
                    } catch (err) { _warn('提升条目失败: ' + err.message); }
                }
            }
            if (count > 0) await _syncAfterWrite(bookName);
            return count;
        },

        /**
         * 兼容旧接口 — 不再创建副本世界书
         */
        resolve: async function (baseName) {
            return baseName;
        },

        getAll: function () {
            return Store.loadIsolationMap();
        },

        remove: async function () { return false; },
        mergeBack: async function () {},
        resetFromBase: async function () {},
        cleanupOrphans: async function () { return []; }
    };

    /* ─── BackupManager: 世界书备份/恢复 ─── */

    var BackupManager = {

        create: async function (bookName, label) {
            var backupName = bookName + '_backup_' + Date.now().toString(36);
            var srcData = await NativeWI._loadBook(bookName);
            try { await NativeWI.createBook(backupName); } catch (e) {}
            await NativeWI._saveBook(backupName, srcData);

            var idx = Store.loadBackupIndex();
            idx.push({
                bookName: bookName,
                backupName: backupName,
                label: label || '',
                timestamp: Date.now(),
                entryCount: srcData.entries ? Object.keys(srcData.entries).length : 0
            });
            Store.saveBackupIndex(idx);
            _log('BackupManager: 创建备份 "' + backupName + '" (label=' + (label||'') + ')');
            return backupName;
        },

        restore: async function (backupName, targetBookName) {
            var backupData = await NativeWI._loadBook(backupName);
            await NativeWI._saveBook(targetBookName, backupData);
            await _syncAfterWrite(targetBookName);
            _log('BackupManager: 恢复 "' + backupName + '" → "' + targetBookName + '"');
            Toast.show('✅ 已从备份恢复世界书', 'success');
        },

        remove: async function (backupName) {
            try {
                await fetch('/api/worldinfo/delete', {
                    method: 'POST',
                    headers: _getRequestHeaders(),
                    body: JSON.stringify({ name: backupName })
                });
            } catch (e) {}
            var idx = Store.loadBackupIndex();
            idx = idx.filter(function (b) { return b.backupName !== backupName; });
            Store.saveBackupIndex(idx);
            _log('BackupManager: 删除备份 "' + backupName + '"');
        },

        list: function (bookName) {
            var idx = Store.loadBackupIndex();
            if (bookName) return idx.filter(function (b) { return b.bookName === bookName; });
            return idx;
        }
    };

    /* ─── ApiPresetManager: API 配置预设 ─── */

    var ApiPresetManager = {

        list: function () {
            return Store.loadApiPresets();
        },

        get: function (id) {
            var presets = this.list();
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].id === id) return presets[i];
            }
            return null;
        },

        save: function (preset) {
            var presets = this.list();
            var found = false;
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].id === preset.id) {
                    presets[i] = preset;
                    found = true;
                    break;
                }
            }
            if (!found) presets.push(preset);
            Store.saveApiPresets(presets);
            return preset;
        },

        create: function (name) {
            var preset = {
                id: 'api_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
                name: name || '新预设',
                createdAt: Date.now(),
                config: JSON.parse(JSON.stringify(RT.api))
            };
            return this.save(preset);
        },

        saveCurrent: function (id) {
            var preset = this.get(id);
            if (!preset) return null;
            preset.config = JSON.parse(JSON.stringify(RT.api));
            preset.modifiedAt = Date.now();
            return this.save(preset);
        },

        load: function (id) {
            var preset = this.get(id);
            if (!preset) return false;
            RT.api = JSON.parse(JSON.stringify(preset.config));
            Store.saveApi(RT.api);
            RT.cfg.activeApiPreset = id;
            Store.saveConfig(RT.cfg);
            _log('ApiPreset: 加载 "' + preset.name + '"');
            return true;
        },

        remove: function (id) {
            var presets = this.list();
            presets = presets.filter(function (p) { return p.id !== id; });
            Store.saveApiPresets(presets);
            if (RT.cfg.activeApiPreset === id) {
                RT.cfg.activeApiPreset = '';
                Store.saveConfig(RT.cfg);
            }
        },

        rename: function (id, newName) {
            var preset = this.get(id);
            if (!preset) return false;
            preset.name = newName;
            this.save(preset);
            return true;
        },

        exportPreset: function (id) {
            var preset = this.get(id);
            if (!preset) return;
            var data = {
                format: 'WBM_ApiPreset',
                version: 1,
                exportedAt: new Date().toISOString(),
                preset: {
                    name: preset.name,
                    config: JSON.parse(JSON.stringify(preset.config))
                }
            };
            // 安全: 清除 API Key
            delete data.preset.config.key;
            this._downloadJson(data, 'WBM_API_' + preset.name + '.json');
        },

        importPreset: function (file, callback) {
            var reader = new FileReader();
            var self = this;
            reader.onload = function (e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (data.format !== 'WBM_ApiPreset') throw new Error('格式不正确');
                    var preset = {
                        id: 'api_' + Date.now().toString(36),
                        name: data.preset.name || '导入的预设',
                        createdAt: Date.now(),
                        config: data.preset.config || {}
                    };
                    self.save(preset);
                    Toast.show('✅ 已导入 API 预设: ' + preset.name, 'success');
                    if (callback) callback(preset);
                } catch (err) {
                    Toast.show('❌ 导入失败: ' + err.message, 'error');
                    if (callback) callback(null);
                }
            };
            reader.readAsText(file);
        },

        _downloadJson: function (data, filename) {
            var json = JSON.stringify(data, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }
    };

    /* ─── PromptPresetManager: 提示词预设 ─── */

    var PromptPresetManager = {

        list: function () {
            return Store.loadPromptPresets();
        },

        get: function (id) {
            var presets = this.list();
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].id === id) return presets[i];
            }
            return null;
        },

        save: function (preset) {
            var presets = this.list();
            var found = false;
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].id === preset.id) {
                    presets[i] = preset;
                    found = true;
                    break;
                }
            }
            if (!found) presets.push(preset);
            Store.savePromptPresets(presets);
            return preset;
        },

        create: function (name) {
            var preset = {
                id: 'prompt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
                name: name || '新提示词预设',
                description: '',
                createdAt: Date.now(),
                entries: JSON.parse(JSON.stringify(RT.promptEntries))
            };
            return this.save(preset);
        },

        saveCurrent: function (id) {
            var preset = this.get(id);
            if (!preset) return null;
            preset.entries = JSON.parse(JSON.stringify(RT.promptEntries));
            preset.modifiedAt = Date.now();
            return this.save(preset);
        },

        load: function (id) {
            var preset = this.get(id);
            if (!preset || !Array.isArray(preset.entries)) return false;
            RT.promptEntries = JSON.parse(JSON.stringify(preset.entries));
            Store.savePromptEntries(RT.promptEntries);
            RT.cfg.activePromptPreset = id;
            Store.saveConfig(RT.cfg);
            _log('PromptPreset: 加载 "' + preset.name + '" (' + preset.entries.length + ' 条)');
            Toast.show('✅ 已加载提示词预设: ' + preset.name, 'success');
            return true;
        },

        remove: function (id) {
            var presets = this.list();
            presets = presets.filter(function (p) { return p.id !== id; });
            Store.savePromptPresets(presets);
            if (RT.cfg.activePromptPreset === id) {
                RT.cfg.activePromptPreset = '';
                Store.saveConfig(RT.cfg);
            }
        },

        rename: function (id, newName) {
            var preset = this.get(id);
            if (!preset) return false;
            preset.name = newName;
            this.save(preset);
            return true;
        },

        setDescription: function (id, desc) {
            var preset = this.get(id);
            if (!preset) return false;
            preset.description = desc;
            this.save(preset);
            return true;
        },

        resetToDefault: function () {
            RT.promptEntries = JSON.parse(JSON.stringify(DEFAULT_PROMPT_ENTRIES));
            Store.savePromptEntries(RT.promptEntries);
            RT.cfg.activePromptPreset = '';
            Store.saveConfig(RT.cfg);
            Toast.show('✅ 已恢复为默认提示词', 'success');
        },

        exportPreset: function (id) {
            var preset = this.get(id);
            if (!preset) return;
            var data = {
                format: 'WBM_PromptPreset',
                version: 1,
                exportedAt: new Date().toISOString(),
                preset: {
                    name: preset.name,
                    description: preset.description || '',
                    entries: preset.entries
                }
            };
            this._downloadJson(data, 'WBM_Prompt_' + preset.name + '.json');
        },

        importPreset: function (file, callback) {
            var reader = new FileReader();
            var self = this;
            reader.onload = function (e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (data.format !== 'WBM_PromptPreset') throw new Error('格式不正确');
                    if (!data.preset || !Array.isArray(data.preset.entries)) throw new Error('缺少entries');
                    var preset = {
                        id: 'prompt_' + Date.now().toString(36),
                        name: data.preset.name || '导入的提示词',
                        description: data.preset.description || '',
                        createdAt: Date.now(),
                        entries: data.preset.entries
                    };
                    self.save(preset);
                    Toast.show('✅ 已导入提示词预设: ' + preset.name, 'success');
                    if (callback) callback(preset);
                } catch (err) {
                    Toast.show('❌ 导入失败: ' + err.message, 'error');
                    if (callback) callback(null);
                }
            };
            reader.readAsText(file);
        },

        /**
         * 批量导出所有预设
         */
        exportAll: function () {
            var presets = this.list();
            var data = {
                format: 'WBM_PromptPresetBundle',
                version: 1,
                exportedAt: new Date().toISOString(),
                presets: presets
            };
            this._downloadJson(data, 'WBM_AllPrompts_' + _formatDate() + '.json');
        },

        _downloadJson: function (data, filename) {
            var json = JSON.stringify(data, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }
    };

    /* ─── EventBridge: 与 ST 事件系统对接 ─── */

    var EventBridge = {
        _bound: false,
        _pollingTimer: null,

        init: function () {
            if (this._bound) return;
            var es = _getEventSource();
            var evT = _getEventTypes();

            if (!es) {
                _warn('EventBridge: 未获取到事件源，启用轮询');
                this._startPolling();
                return;
            }

            var self = this;

            // AI 消息完成后
            var afterEv = evT.MESSAGE_RECEIVED || evT.CHARACTER_MESSAGE_RENDERED || 'message_received';
            es.on(afterEv, function () {
                setTimeout(function () {
                    if (RT.cfg.triggerTiming === 'after' || RT.cfg.triggerTiming === 'both') Sched.onNew();
                }, 600);
            });

            // AI 生成前
            var beforeEv = evT.GENERATION_STARTED || evT.GENERATE_BEFORE || 'generation_started';
            es.on(beforeEv, function () {
                if (RT.cfg.triggerTiming === 'before' || RT.cfg.triggerTiming === 'both') {
                    Sched.onBeforeGenerate();
                }
            });

            // 消息删除
            var delEv = evT.MESSAGE_DELETED || 'message_deleted';
            es.on(delEv, function (data) {
                if (RT.cfg.syncOnDelete) Sched.onMessageDeleted(data);
            });

            // 聊天切换
            var chatEv = evT.CHAT_CHANGED || evT.CHAT_COMPLETION_SETTINGS_READY || 'chat_id_changed';
            es.on(chatEv, function () {
                var newId = _getChatId();
                if (newId && newId !== RT._lastChatId) {
                    var oldId = RT._lastChatId;
                    RT._lastChatId = newId;
                    RT.lastAiFloor = _aiFloor();
                    RT.lastProcessedAiFloor = 0;
                    RT.nextUpdateAiFloor = Sched.nextUp(RT.lastAiFloor);
                    // ★ 清理上一个聊天的临时数据
                    RT.backendChats = [];
                    RT.debugHistory = [];
                    RT.lastDebug = null;
                    _log('EventBridge: 聊天切换 ' + (oldId || '?') + ' → ' + newId);
                    if (typeof UI !== 'undefined' && UI.status) UI.status();
                }
            });

            this._bound = true;
            _log('EventBridge: 已绑定事件');

            // 低频兜底：即使事件正常绑定，也以低频率检查楼层变化
            // 防止某些 ST 版本事件不触发的情况
            if (!this._pollingTimer) {
                var lastKnownFloor = _aiFloor();
                this._pollingTimer = setInterval(function () {
                    try {
                        var cur = _aiFloor();
                        if (cur > lastKnownFloor) {
                            // 事件可能漏了，补发
                            if (cur > RT.lastAiFloor) {
                                _log('EventBridge: 兜底检测到新楼层 ' + lastKnownFloor + ' → ' + cur);
                                Sched.onNew();
                            }
                            lastKnownFloor = cur;
                        } else if (cur < lastKnownFloor) {
                            lastKnownFloor = cur;
                        }
                    } catch (e) {}
                }, 5000);
            }
        },

        _startPolling: function () {
            if (this._pollingTimer) return;
            var lastF = _aiFloor();
            this._pollingTimer = setInterval(function () {
                var cur = _aiFloor();
                if (cur > lastF) {
                    lastF = cur;
                    if (RT.cfg.triggerTiming !== 'before') Sched.onNew();
                }
            }, 3000);
            _log('EventBridge: 轮询模式 (3s)');
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §4  世界书操作                                        ║
    // ╚═══════════════════════════════════════════════════════╝

    var Book = {
        uid: function (e) { return e ? (e.uid || e.id || null) : null; },

        _full: function (fields) {
            var f = {}, k;
            for (k in FULL_ENTRY_TEMPLATE) f[k] = FULL_ENTRY_TEMPLATE[k];
            if (RT.entryDef) for (k in RT.entryDef) f[k] = RT.entryDef[k];
            if (fields) for (k in fields) f[k] = fields[k];
            if (!f.name || !String(f.name).trim()) f.name = _getKeys(f) ? _getKeys(f).split(',')[0].trim() : ('E_' + Date.now().toString(36));
            f.name = String(f.name).trim();
            // 仅在 comment 为空或已是 WBM 自动生成的前缀时才覆盖
            if (!f.comment || !String(f.comment).trim() || String(f.comment).indexOf(NS) === 0) {
                f.comment = NS + f.name;
            }
            if (f.depth != null) f.context = f.depth; else if (f.context != null) f.depth = f.context;
            if (_isConExplicit(f)) { f.constant = true; f.selective = false; }
            if (!f.constant && f.selective && !_getKeys(f)) f.keys = f.name;

            // 清理 null/undefined 字段（TavernHelper 不接受 null）
            var cleanF = {};
            for (var ck in f) {
                if (f.hasOwnProperty(ck) && f[ck] != null) {
                    cleanF[ck] = f[ck];
                }
            }
            // 确保必要字段始终存在
            if (cleanF.enabled === undefined) cleanF.enabled = true;
            if (!cleanF.name) cleanF.name = f.name;
            if (!cleanF.comment) cleanF.comment = f.comment;
            if (!cleanF.content) cleanF.content = f.content || '';

            return cleanF;
        },

        getTargetBookName: async function () {
            var tt = RT.cfg.targetType, tn = RT.cfg.targetBookName;
            var baseName = null;
            try {
                if (tt === 'managed') {
                    var ex = NativeWI.getChatBookName();
                    if (ex) { baseName = ex; }
                    else {
                        try {
                            var cb = _safeCharBooks(); var prefix = cb.primary || 'WB';
                            var newName = prefix + '_WBM_' + _formatDate();
                            await WI.createBook(newName);
                            baseName = newName;
                        } catch (e) { _warn('创建世界书失败: ' + e.message); }
                    }
                } else if (tt === 'charPrimary') {
                    if (WI._backend === 'tavernHelper' && typeof TavernHelper.getCurrentCharPrimaryLorebook === 'function') {
                        try {
                            baseName = TavernHelper.getCurrentCharPrimaryLorebook();
                        } catch (e) {}
                    }
                    if (!baseName) {
                        baseName = _safeCharBooks().primary || null;
                    }
                } else if (tt === 'charAdditional') {
                    if (tn) { var ca = _safeCharBooks().additional || []; baseName = ca.indexOf(tn) !== -1 ? tn : null; }
                } else if (tt === 'global') {
                    if (tn) { var gl = NativeWI.getGlobalBookNames(); baseName = (Array.isArray(gl) && gl.indexOf(tn) !== -1) ? tn : null; }
                }
            } catch (e) { _err('getTargetBookName', e); }

            if (!baseName) {
                RT.lastManagedBookName = null;
                return null;
            }

            RT.lastManagedBookName = baseName;

            // 隔离通过条目的 automationId 标记实现，不再创建副本世界书
            // 直接返回原名
            return baseName;
        },

        getEntries: async function (bk, skipIsolation) {
            if (!bk) return [];
            try {
                var r = await WI.getLorebookEntries(bk);
                if (!Array.isArray(r)) return [];
                if (!RT._diagDone && r.length > 0) {
                    RT._diagDone = true;
                    var conCount = 0; r.forEach(function (e) { if (_isCon(e)) conCount++; });
                    RT._diagData = { sampleConstant: r[0].constant, totalConstantTruthy: conCount, total: r.length };
                }
                // 聊天隔离过滤
                if (!skipIsolation) {
                    r = _filterByIsolation(r);
                }
                return r;
            } catch (e) { _err('getEntries: ' + bk, e); return []; }
        },

        addEntry: async function (bk, fields) {
            var f = this._full(fields);
            // 聊天隔离：为新条目自动添加隔离标记
            if (RT.cfg.chatIsolationEnabled) {
                var tag = _getIsolationTag();
                if (tag && !f.automationId) {
                    f.automationId = tag;
                }
            }
            _log('addEntry: name=' + f.name + ' → ' + bk);
            await WI.addLorebookEntry(bk, f);
            return f;
        },

        updateEntry: async function (bk, entry) {
            var uid = this.uid(entry); if (!uid) throw new Error('缺少uid');
            if (entry.depth != null) entry.context = entry.depth;
            else if (entry.context != null) entry.depth = entry.context;
            await WI.updateLorebookEntry(bk, entry);
        },

        deleteEntry: async function (bk, uid) {
            await WI.deleteLorebookEntry(bk, uid);
        },

        setField: async function (bk, uid, field, value) {
            var entries = await this.getEntries(bk); var t = null;
            for (var i = 0; i < entries.length; i++) { if (this.uid(entries[i]) === uid) { t = entries[i]; break; } }
            if (!t) throw new Error('未找到');
            var u = {}; for (var k in t) u[k] = t[k]; u[field] = value;
            if (field === 'depth') u.context = value;
            if (field === 'constant') { if (value) { u.constant = true; u.selective = false; } else { u.constant = false; u.selective = true; } }
            await this.updateEntry(bk, u);
            await _syncAfterWrite(bk);
        },

        getAvailableBooks: function () {
            var r = [];
            try { var g = NativeWI.getGlobalBookNames(); if (Array.isArray(g)) g.forEach(function (n) { r.push({ name: n, type: 'global' }); }); } catch (e) {}
            try { var c = _safeCharBooks(); if (c.primary) r.push({ name: c.primary, type: 'charPrimary' }); if (Array.isArray(c.additional)) c.additional.forEach(function (n) { r.push({ name: n, type: 'charAdditional' }); }); } catch (e) {}
            try { var ch = NativeWI.getChatBookName(); if (ch) r.push({ name: ch, type: 'chat' }); } catch (e) {}
            return r;
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §5  搜索 + 解析                                       ║
    // ╚═══════════════════════════════════════════════════════╝

    var Search = {
        find: function (entries, kw) {
            if (!kw) return entries.map(function (e) { return { entry: e, score: 0 }; });
            var k = kw.toLowerCase().trim(), r = [];
            entries.forEach(function (e) {
                var s = 0, nl = _dn(e).toLowerCase();
                if (nl === k) s = 100; else if (nl.indexOf(k) !== -1) s = 80;
                var ek = _getKeys(e); if (!s && ek && ek.toLowerCase().indexOf(k) !== -1) s = 70;
                if (!s && e.content && e.content.toLowerCase().indexOf(k) !== -1) s = 30;
                if (s > 0) r.push({ entry: e, score: s });
            });
            r.sort(function (a, b) { return b.score - a.score; }); return r;
        },
        exact: function (entries, name) {
            if (!name) return null;
            var i, trimmed = name.trim();
            var nameNoPrefix = trimmed.indexOf(NS) === 0 ? trimmed.slice(NS.length) : trimmed;

            // 第一轮：精确匹配 name 字段
            for (i = 0; i < entries.length; i++) {
                var eName = entries[i].name ? String(entries[i].name).trim() : '';
                if (eName === trimmed || eName === nameNoPrefix) return entries[i];
            }
            // 第二轮：匹配 comment（剥离前缀后）
            for (i = 0; i < entries.length; i++) {
                var eComment = entries[i].comment ? String(entries[i].comment).trim() : '';
                var cleanComment = eComment.indexOf(NS) === 0 ? eComment.slice(NS.length) : eComment;
                if (cleanComment === trimmed || cleanComment === nameNoPrefix) return entries[i];
                if (eComment === trimmed) return entries[i];
            }
            // 第三轮：显示名匹配
            for (i = 0; i < entries.length; i++) {
                if (_dn(entries[i]) === trimmed || _dn(entries[i]) === nameNoPrefix) return entries[i];
            }
            // 第四轮：大小写无关
            var lower = nameNoPrefix.toLowerCase();
            for (i = 0; i < entries.length; i++) {
                if (_dn(entries[i]).toLowerCase() === lower) return entries[i];
            }
            return null;
        },
        best: function (entries, name) { var r = this.find(entries, name); return (r.length > 0 && r[0].score >= 80) ? r[0].entry : null; }
    };

    var Parser = {
        /** 解析 <world_update> 标签，支持 create/update/delete/patch */
        parse: function (text) {
            if (!text) return [];
            var raw = _decodeEntities(text);
            var m = raw.match(/<world_update>([\s\S]*?)<\/world_update>/i);
            if (!m) return [];
            try {
                var jsonText = m[1].trim();
                var arr = _robustJsonParse(jsonText);
                if (!Array.isArray(arr)) return [];
                return arr.filter(function (c) {
                    return c && typeof c.action === 'string' && typeof c.entry_name === 'string' &&
                        ['create', 'update', 'delete', 'patch'].indexOf(c.action.toLowerCase()) !== -1;
                }).map(function (c) {
                    return {
                        action: c.action.toLowerCase(),
                        entry_name: c.entry_name.trim(),
                        fields: c.fields || {},
                        ops: Array.isArray(c.ops) ? c.ops : []
                    };
                });
            } catch (e) { _warn('解析JSON失败: ' + e.message); return []; }
        },
        strip: function (html) {
            if (!html) return '';
            return html.replace(/<world_update>[\s\S]*?<\/world_update>/gi, '')
                       .replace(/&lt;world_update&gt;[\s\S]*?&lt;\/world_update&gt;/gi, '').trim();
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §6  增量更新处理器 (PatchProcessor)                   ║
    // ╚═══════════════════════════════════════════════════════╝

    var PatchProcessor = {

        /**
         * 对一个条目执行一组增量操作
         * @param {Object} entry    - 当前条目对象（将被原地修改）
         * @param {Array}  ops      - 操作数组
         * @returns {{ applied: number, skipped: number, errors: string[] }}
         */
        apply: function (entry, ops) {
            var result = { applied: 0, skipped: 0, errors: [] };
            if (!entry || !Array.isArray(ops)) return result;

            for (var i = 0; i < ops.length; i++) {
                var op = ops[i];
                if (!op || !op.op) { result.skipped++; continue; }

                try {
                    var opType = op.op.toLowerCase();

                    switch (opType) {
                        // ---- 内容操作 ----
                        case 'append':
                            if (this._opAppend(entry, op)) result.applied++;
                            else result.skipped++;
                            break;

                        case 'prepend':
                            if (this._opPrepend(entry, op)) result.applied++;
                            else result.skipped++;
                            break;

                        case 'insert_after':
                            if (this._opInsertAfter(entry, op)) result.applied++;
                            else { result.skipped++; result.errors.push('insert_after: 未找到锚点 "' + (op.anchor||'') + '"'); }
                            break;

                        case 'insert_before':
                            if (this._opInsertBefore(entry, op)) result.applied++;
                            else { result.skipped++; result.errors.push('insert_before: 未找到锚点 "' + (op.anchor||'') + '"'); }
                            break;

                        case 'replace_text':
                            if (this._opReplaceText(entry, op)) result.applied++;
                            else { result.skipped++; result.errors.push('replace_text: 未找到 "' + (op.find||'') + '"'); }
                            break;

                        case 'remove_text':
                            if (this._opRemoveText(entry, op)) result.applied++;
                            else { result.skipped++; result.errors.push('remove_text: 未找到 "' + (op.find||'') + '"'); }
                            break;

                        // ---- 字段操作 ----
                        case 'set_field':
                            this._opSetField(entry, op);
                            result.applied++;
                            break;

                        // ---- 关键词操作 ----
                        case 'add_key':
                            this._opAddKey(entry, op, 'primary');
                            result.applied++;
                            break;

                        case 'remove_key':
                            this._opRemoveKey(entry, op, 'primary');
                            result.applied++;
                            break;

                        case 'add_secondary_key':
                            this._opAddKey(entry, op, 'secondary');
                            result.applied++;
                            break;

                        case 'remove_secondary_key':
                            this._opRemoveKey(entry, op, 'secondary');
                            result.applied++;
                            break;

                        default:
                            result.skipped++;
                            result.errors.push('未知操作: ' + opType);
                    }
                } catch (e) {
                    result.skipped++;
                    result.errors.push(opType + ' 执行失败: ' + e.message);
                }
            }

            return result;
        },

        // ---- 内容操作实现 ----

        _opAppend: function (entry, op) {
            var val = op.value || '';
            if (!val) return false;
            var content = entry.content || '';
            if (RT.cfg.patchDuplicateGuard && content.indexOf(val) !== -1) {
                _log('patch append: 内容已存在，跳过重复追加');
                return false;
            }
            entry.content = content + val;
            return true;
        },

        _opPrepend: function (entry, op) {
            var val = op.value || '';
            if (!val) return false;
            var content = entry.content || '';
            if (RT.cfg.patchDuplicateGuard && content.indexOf(val) !== -1) {
                _log('patch prepend: 内容已存在，跳过重复添加');
                return false;
            }
            entry.content = val + content;
            return true;
        },

        _opInsertAfter: function (entry, op) {
            var anchor = op.anchor, val = op.value;
            if (!anchor || !val) return false;
            var content = entry.content || '';
            var idx = content.indexOf(anchor);
            if (idx === -1) return false;
            var pos = idx + anchor.length;
            entry.content = content.slice(0, pos) + val + content.slice(pos);
            return true;
        },

        _opInsertBefore: function (entry, op) {
            var anchor = op.anchor, val = op.value;
            if (!anchor || !val) return false;
            var content = entry.content || '';
            var idx = content.indexOf(anchor);
            if (idx === -1) return false;
            entry.content = content.slice(0, idx) + val + content.slice(idx);
            return true;
        },

        _opReplaceText: function (entry, op) {
            var find = op.find, val = op.value;
            if (!find) return false;
            var content = entry.content || '';
            if (content.indexOf(find) === -1) return false;
            entry.content = content.split(find).join(val || '');
            return true;
        },

        _opRemoveText: function (entry, op) {
            var find = op.find;
            if (!find) return false;
            var content = entry.content || '';
            if (content.indexOf(find) === -1) return false;
            entry.content = content.split(find).join('');
            return true;
        },

        // ---- 字段操作实现 ----

        _opSetField: function (entry, op) {
            var field = op.field, val = op.value;
            if (!field) return;

            // 安全白名单
            var allowed = ['depth','order','position','role','enabled','constant','selective',
                           'selectiveLogic','probability','useProbability','sticky','cooldown',
                           'delay','prevent_recursion','excludeRecursion','vectorized',
                           'scanDepth','caseSensitive','matchWholeWords','group','groupWeight',
                           'groupOverride','useGroupScoring','automationId','ignoreBudget'];

            if (allowed.indexOf(field) === -1) {
                _warn('set_field: 不允许修改字段 "' + field + '"');
                return;
            }

            entry[field] = val;

            // 联动
            if (field === 'depth') entry.context = val;
            if (field === 'enabled') { entry.disable = !val; entry.disabled = !val; }
            if (field === 'constant') {
                if (val) { entry.constant = true; entry.selective = false; }
                else { entry.constant = false; entry.selective = true; }
            }
        },

        // ---- 关键词操作实现 ----

        _opAddKey: function (entry, op, type) {
            var val = op.value;
            if (!val) return;
            if (type === 'primary') {
                var keys = _getKeys(entry);
                var arr = keys ? keys.split(',').map(function(k){ return k.trim(); }) : [];
                if (arr.indexOf(val.trim()) === -1) arr.push(val.trim());
                _setKeys(entry, arr.join(','));
            } else {
                var skeys = _getSecondaryKeys(entry);
                var sarr = skeys ? skeys.split(',').map(function(k){ return k.trim(); }) : [];
                if (sarr.indexOf(val.trim()) === -1) sarr.push(val.trim());
                _setSecondaryKeys(entry, sarr.join(','));
            }
        },

        _opRemoveKey: function (entry, op, type) {
            var val = op.value;
            if (!val) return;
            if (type === 'primary') {
                var keys = _getKeys(entry);
                var arr = keys ? keys.split(',').map(function(k){ return k.trim(); }).filter(function(k){ return k !== val.trim(); }) : [];
                _setKeys(entry, arr.join(','));
            } else {
                var skeys = _getSecondaryKeys(entry);
                var sarr = skeys ? skeys.split(',').map(function(k){ return k.trim(); }).filter(function(k){ return k !== val.trim(); }) : [];
                _setSecondaryKeys(entry, sarr.join(','));
            }
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §7  路由（含 patch 支持）                               ║
    // ╚═══════════════════════════════════════════════════════╝

    var Router = {
        // ★ Promise 队列实现并发安全
        _queue: Promise.resolve(),

        execute: function (cmds, bk, opts) {
            var self = this;
            // 所有 execute 调用排入队列，串行执行
            this._queue = this._queue.then(function () {
                return self._executeImpl(cmds, bk, opts || {});
            }).catch(function (e) {
                _err('Router queue error', e);
                return [{ action: 'error', entry_name: '(队列异常)', status: 'error', reason: e.message }];
            });
            return this._queue;
        },

        _executeImpl: async function (cmds, bk, opts) {
            _log('Router: ' + cmds.length + ' 条指令 → ' + bk +
                 ' | backend=' + WI._backend +
                 ' | approvalMode=' + RT.cfg.approvalMode +
                 ' skipApproval=' + !!opts.skipApproval +
                 ' floor=' + (opts.floor || RT.lastAiFloor));

            // ── 审核模式拦截 ──
            if (!opts.skipApproval && RT.cfg.approvalMode !== 'auto') {
                var needApproval = false;
                if (RT.cfg.approvalMode === 'manual') {
                    needApproval = true;
                } else if (RT.cfg.approvalMode === 'selective') {
                    needApproval = cmds.some(function (c) { return c.action === 'create' || c.action === 'delete'; });
                }
                if (needApproval) {
                    PendingQueue.add(cmds, opts.floor || RT.lastAiFloor, bk, opts.rawReply || '');
                    Toast.show('📋 ' + cmds.length + ' 条指令已加入审核队列', 'info');
                    if (typeof UI !== 'undefined' && UI.status) UI.status();
                    return [{ action: 'queue', entry_name: '(审核队列)', status: 'queued', reason: cmds.length + ' 条待审核' }];
                }
            }

            // ── 检查锁定条目 ──
            var lockedNames = [];
            if (RT.cfg.entryLockEnabled) {
                lockedNames = Store.loadLockedEntries(bk);
            }

            // ── 自动备份 ──
            if (RT.cfg.autoBackupBeforeAI && cmds.length > 0) {
                try { await BackupManager.create(bk, 'auto_floor_' + (opts.floor || RT.lastAiFloor)); }
                catch (e) { _warn('自动备份失败: ' + e.message); }
            }

            // ── 批量加载世界书 ──
            var entries = await Book.getEntries(bk);
            var results = [];
            var cc = 0;
            var snapshotOps = [];
            var modified = false;

            for (var i = 0; i < cmds.length; i++) {
                var cmd = cmds[i];
                _log('  [' + (i + 1) + '] ' + cmd.action + ' 「' + cmd.entry_name + '」');

                // 锁定检查
                if (lockedNames.indexOf(cmd.entry_name) !== -1 && cmd.action !== 'create') {
                    _log('  → 跳过（条目已锁定）');
                    results.push({ action: cmd.action, entry_name: cmd.entry_name, status: 'skipped', reason: '条目已锁定' });
                    continue;
                }

                if (cmd.action === 'create' && cc >= RT.cfg.maxCreatePerRound) {
                    results.push({ action: cmd.action, entry_name: cmd.entry_name, status: 'skipped', reason: '超限' });
                    continue;
                }

                // 保存操作前快照
                var beforeEntry = null;
                if (cmd.action !== 'create') {
                    var target = Search.exact(entries, cmd.entry_name) || Search.best(entries, cmd.entry_name);
                    if (target) { try { beforeEntry = JSON.parse(JSON.stringify(target)); } catch (e) { beforeEntry = null; } }
                }

                try {
                    var r = await this._do(cmd, bk, entries, opts);
                    results.push(r);
                    if (r.status === 'ok') {
                        modified = true;
                        if (cmd.action === 'create') cc++;

                        // AI 注册表追踪
                        if (RT.cfg.aiRegistryEnabled) {
                            var fl = opts.floor || RT.lastAiFloor;
                            var detail = '';
                            if (cmd.action === 'patch' && cmd.ops) {
                                detail = cmd.ops.map(function (o) { return o.op + ':' + (o.value || o.find || '').substring(0, 50); }).join('; ');
                            } else if (cmd.action === 'update' && cmd.fields && cmd.fields.content) {
                                detail = 'content更新(' + cmd.fields.content.length + '字)';
                            }
                            AIRegistry.track(bk, cmd.entry_name, cmd.action, fl, detail);
                            if (cmd.action === 'delete') AIRegistry.markDeleted(bk, cmd.entry_name);
                        }
                    }

                    // 快照记录
                    if (r.status === 'ok' && RT.cfg.syncOnDelete) {
                        snapshotOps.push({
                            action: cmd.action,
                            entry_name: cmd.entry_name,
                            before: beforeEntry,
                            afterUid: null
                        });
                    }

                    // 后续还有命令时刷新条目缓存
                    if (r.status === 'ok' && i < cmds.length - 1) {
                        entries = await Book.getEntries(bk);
                    }
                } catch (e) {
                    _err('执行异常: ' + cmd.entry_name, e);
                    results.push({ action: cmd.action, entry_name: cmd.entry_name, status: 'error', reason: e.message });
                }
            }

            // ── 同步 ST 内存 ──
            // TavernHelper 直接操作内存，无需额外同步
            // REST API 后端则需要触发 ST 重载
            if (modified) {
                await _syncAfterWrite(bk);
            }

            // 获取最新条目，用于快照 UID 补全和验证
            if (modified) {
                await _sleep(100);
                // skipIsolation=true：确保能找到刚创建的条目（包括带隔离标记的）
                var freshEntries = await Book.getEntries(bk, true);

                // 补全快照中的 afterUid
                for (var si = 0; si < snapshotOps.length; si++) {
                    if (snapshotOps[si].action === 'create') {
                        var created = Search.exact(freshEntries, snapshotOps[si].entry_name);
                        if (created) snapshotOps[si].afterUid = Book.uid(created);
                    }
                }
            }

            // 保存快照
            if (snapshotOps.length > 0) {
                var sfl = opts.floor || RT.lastAiFloor;
                SnapshotStore.save(sfl, _getChatId(), bk, snapshotOps);
            }

            // 写日志
            results.forEach(function (r) {
                Store.appendLog({ floor: RT.lastAiFloor, action: r.action, name: r.entry_name, status: r.status, reason: r.reason || '', detail: r.detail || '' });
            });
            Store.flushLog();

            // ── 写入验证 ──
            if (modified && RT.cfg.autoVerifyAfterUpdate) {
                try {
                    var vr = await BookSync.verify(bk, results);
                    if (!vr.ok) {
                        _warn('BookSync: ' + vr.issues.length + ' 个写入问题，尝试修复');
                        var rr = await BookSync.repair(bk, vr, cmds);
                        if (rr.repaired > 0) {
                            Toast.show('🔧 自动修复了 ' + rr.repaired + ' 个写入问题', 'info');
                            await _syncAfterWrite(bk);
                        }
                        if (rr.failed > 0) Toast.show('⚠ ' + rr.failed + ' 个问题无法自动修复', 'warning');
                    } else {
                        _log('BookSync: 验证通过，' + vr.checked + ' 条全部正确');
                    }
                } catch (e) {
                    _warn('BookSync verify 异常: ' + e.message);
                }
            }

            return results;
        },

        _do: async function (cmd, bk, entries, opts) {
            opts = opts || {};
            var a = cmd.action, n = cmd.entry_name, f = cmd.fields || {}, ops = cmd.ops || [];
            if (f.depth != null) f.context = f.depth;

            if (a === 'create') {
                var dup = Search.exact(entries, n);
                if (dup) {
                    var m = {}; for (var k in dup) m[k] = dup[k];
                    var hC = f.hasOwnProperty('constant'), hS = f.hasOwnProperty('selective');
                    for (var k2 in f) m[k2] = f[k2];
                    if (!hC) m.constant = dup.constant; if (!hS) m.selective = dup.selective;
                    if (_isConExplicit(m)) m.selective = false;
                    await Book.updateEntry(bk, m);
                    return { action: a, entry_name: n, status: 'ok', detail: '已合并' };
                }
                var cf = { name: n }; for (var k3 in f) cf[k3] = f[k3];
                await Book.addEntry(bk, cf);
                return { action: a, entry_name: n, status: 'ok', detail: '已创建' };

            } else if (a === 'update') {
                var t = Search.exact(entries, n) || Search.best(entries, n);
                if (!t) return { action: a, entry_name: n, status: 'skipped', reason: '未找到，请用create' };
                var m2 = {}; for (var k4 in t) m2[k4] = t[k4];
                var aC = f.hasOwnProperty('constant'), aS = f.hasOwnProperty('selective');
                for (var k5 in f) m2[k5] = f[k5];
                if (!aC) m2.constant = t.constant; if (!aS) m2.selective = t.selective;
                if (aC && _isConExplicit(m2)) m2.selective = false;
                if (f.name && f.name !== t.name) {
                    m2.comment = NS + f.name;
                    if (RT.cfg.aiRegistryEnabled) AIRegistry.rename(bk, n, f.name);
                }
                await Book.updateEntry(bk, m2);
                return { action: a, entry_name: n, status: 'ok', detail: t.name === n ? '已更新' : '模糊:' + t.name };

            } else if (a === 'delete') {
                var t2 = Search.exact(entries, n);
                if (!t2) return { action: a, entry_name: n, status: 'skipped', reason: '未找到' };
                var uid = Book.uid(t2); if (!uid) return { action: a, entry_name: n, status: 'error', reason: '无uid' };
                if (RT.cfg.confirmDelete && !opts.isManual && !opts.skipApproval) {
                    _log('delete: 安全保护拦截「' + n + '」→ 加入审核队列');
                    PendingQueue.add([cmd], opts.floor || RT.lastAiFloor, bk, opts.rawReply || '');
                    return { action: a, entry_name: n, status: 'queued', reason: '删除需人工审核' };
                }
                await Book.deleteEntry(bk, uid);
                return { action: a, entry_name: n, status: 'ok', detail: '已删除' };

            } else if (a === 'patch') {
                var tgt = Search.exact(entries, n) || Search.best(entries, n);
                if (!tgt) return { action: a, entry_name: n, status: 'skipped', reason: '未找到' };
                var patched;
                try { patched = JSON.parse(JSON.stringify(tgt)); } catch (e) { patched = {}; for (var pk in tgt) patched[pk] = tgt[pk]; }
                if (f && Object.keys(f).length > 0) { for (var fk in f) patched[fk] = f[fk]; }
                var pr = PatchProcessor.apply(patched, ops);
                if (pr.applied === 0 && Object.keys(f).length === 0)
                    return { action: a, entry_name: n, status: 'skipped', reason: '无有效操作: ' + pr.errors.join('; ') };
                if (patched.depth != null) patched.context = patched.depth;
                await Book.updateEntry(bk, patched);
                var mn = tgt.name === n ? '' : ' (模糊:' + tgt.name + ')';
                return { action: a, entry_name: n, status: 'ok', detail: '已patch' + mn + ' applied:' + pr.applied };
            }

            return { action: a, entry_name: n, status: 'error', reason: '未知动作' };
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §7.5  写入验证与修复 (BookSync)                       ║
    // ╚═══════════════════════════════════════════════════════╝

    var BookSync = {

        /**
         * 验证 Router 执行结果是否真正写入了世界书
         * @param {string} bookName
         * @param {Array}  results  - Router.execute 返回的结果数组
         * @returns {{ ok:boolean, issues:Array, checked:number }}
         */
        verify: async function (bookName, results) {
            // 使用 skipIsolation=true 获取完整列表
            // 验证需要确认条目确实写入了世界书，不受隔离过滤影响
            var entries = await Book.getEntries(bookName, true);
            var issues = [];
            var checked = 0;

            for (var i = 0; i < results.length; i++) {
                var r = results[i];
                if (r.status !== 'ok') continue;
                checked++;

                if (r.action === 'create') {
                    var found = Search.exact(entries, r.entry_name);
                    if (!found) {
                        issues.push({
                            type: 'missing', action: 'create',
                            entry_name: r.entry_name, detail: '创建后未在世界书中找到'
                        });
                    }
                } else if (r.action === 'update' || r.action === 'patch') {
                    var found2 = Search.exact(entries, r.entry_name) || Search.best(entries, r.entry_name);
                    if (!found2) {
                        issues.push({
                            type: 'missing', action: r.action,
                            entry_name: r.entry_name, detail: '更新后条目消失'
                        });
                    }
                } else if (r.action === 'delete') {
                    var still = Search.exact(entries, r.entry_name);
                    if (still) {
                        issues.push({
                            type: 'still_exists', action: 'delete',
                            entry_name: r.entry_name, detail: '删除后条目仍存在'
                        });
                    }
                }
            }

            return { ok: issues.length === 0, issues: issues, checked: checked };
        },

        /**
         * 修复验证发现的问题
         * @param {string} bookName
         * @param {{ issues:Array }} verifyResult
         * @param {Array}  originalCmds - 原始指令数组
         * @returns {{ repaired:number, failed:number }}
         */
        repair: async function (bookName, verifyResult, originalCmds) {
            if (!verifyResult || verifyResult.ok) return { repaired: 0, failed: 0 };
            var repaired = 0, failed = 0;

            for (var i = 0; i < verifyResult.issues.length; i++) {
                var issue = verifyResult.issues[i];
                var origCmd = null;
                for (var j = 0; j < originalCmds.length; j++) {
                    if (originalCmds[j].entry_name === issue.entry_name) {
                        origCmd = originalCmds[j]; break;
                    }
                }
                if (!origCmd) { failed++; continue; }

                try {
                    if (issue.type === 'missing') {
                        if (origCmd.action === 'create' || origCmd.action === 'update') {
                            var fields = {};
                            for (var fk in (origCmd.fields || {})) fields[fk] = origCmd.fields[fk];
                            fields.name = origCmd.entry_name;
                            await Book.addEntry(bookName, fields);
                            _log('BookSync repair: 重建 "' + origCmd.entry_name + '"');
                            repaired++;
                        } else if (origCmd.action === 'patch') {
                            // patch 目标丢失，无法恢复（因缺少原始完整内容）
                            _warn('BookSync: patch 目标 "' + origCmd.entry_name + '" 丢失，无法自动修复');
                            failed++;
                        }
                    } else if (issue.type === 'still_exists' && origCmd.action === 'delete') {
                        var entries = await Book.getEntries(bookName);
                        var target = Search.exact(entries, origCmd.entry_name);
                        if (target) {
                            await Book.deleteEntry(bookName, Book.uid(target));
                            repaired++;
                        }
                    }
                } catch (e) {
                    _warn('BookSync repair 失败: ' + issue.entry_name + ': ' + e.message);
                    failed++;
                }
            }

            if (repaired > 0) {
                await _syncAfterWrite(bookName);
            }

            return { repaired: repaired, failed: failed };
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §8  API                                               ║
    // ╚═══════════════════════════════════════════════════════╝

    var API = {
        callMain: async function (msgs) {
            var r = await WI.generateRaw({ ordered_prompts: msgs, should_stream: false });
            if (typeof r !== 'string') throw new Error('无文本');
            return r.trim();
        },
        callCustom: async function (msgs, cfg, signal) {
            if (!cfg.endpoint || !cfg.model) throw new Error('API未配置');
            var body = { messages: msgs, model: cfg.model.replace(/^models\//, ''), max_tokens: cfg.maxTokens || 4096, temperature: cfg.temperature || 0.7, top_p: cfg.topP || 0.95, stream: false, reverse_proxy: cfg.endpoint, custom_url: cfg.endpoint, custom_include_headers: cfg.key ? ('Authorization: Bearer ' + cfg.key) : '', chat_completion_source: 'custom', should_stream: false, include_reasoning: false, group_names: [], custom_prompt_post_processing: 'strict', proxy_password: '' };
            var opts = { method: 'POST', headers: {}, body: JSON.stringify(body) };
            try { var h = SillyTavern.getRequestHeaders(); for (var k in h) opts.headers[k] = h[k]; } catch (e) { }
            opts.headers['Content-Type'] = 'application/json'; if (signal) opts.signal = signal;
            var resp = await fetch('/api/backends/chat-completions/generate', opts);
            if (!resp.ok) { var d = ''; try { d = JSON.stringify(await resp.json()); } catch (e) { } throw new Error('HTTP ' + resp.status + ' ' + d); }
            var j = await resp.json();
            var text = j.text || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
            if (!text) throw new Error('无文本'); return text.trim();
        },
        callGemini: async function (msgs, cfg, signal) {
            if (!cfg.endpoint || !cfg.model || !cfg.key) throw new Error('Gemini未配置');
            var url = cfg.endpoint.replace(/\/+$/, '') + '/models/' + cfg.model + ':generateContent?key=' + cfg.key;
            var contents = [], sysTxt = '';
            msgs.forEach(function (m) { if (m.role === 'system') sysTxt += (sysTxt ? '\n\n' : '') + m.content; else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }); });
            if (sysTxt && contents.length > 0) contents[0].parts[0].text = sysTxt + '\n\n' + contents[0].parts[0].text;
            else if (sysTxt) contents.push({ role: 'user', parts: [{ text: sysTxt }] });
            var merged = []; contents.forEach(function (c) { var last = merged.length > 0 ? merged[merged.length - 1] : null; if (last && last.role === c.role) last.parts[0].text += '\n\n' + c.parts[0].text; else merged.push({ role: c.role, parts: [{ text: c.parts[0].text }] }); });
            var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: merged, generationConfig: { maxOutputTokens: cfg.maxTokens || 4096, temperature: cfg.temperature || 0.7 } }) };
            if (signal) opts.signal = signal;
            var resp = await fetch(url, opts); if (!resp.ok) throw new Error('Gemini HTTP ' + resp.status);
            var j = await resp.json(); var t = null;
            if (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0]) t = j.candidates[0].content.parts[0].text;
            if (!t) throw new Error('Gemini空响应'); return t.trim();
        },
        call: async function (msgs, cfgOv, signal) { var src = (cfgOv && cfgOv.apiSource) || RT.cfg.apiSource; if (src === 'tavern') return await this.callMain(msgs); var cfg = cfgOv || RT.api; if (cfg.type === 'gemini') return await this.callGemini(msgs, cfg, signal); return await this.callCustom(msgs, cfg, signal); },
        callTO: async function (msgs, ms) { var ac = new AbortController(); var to = ms || RT.api.timeoutMs || 120000; var timer = setTimeout(function () { ac.abort(); }, to); try { return await this.call(msgs, null, ac.signal); } catch (e) { if (e.name === 'AbortError') throw new Error('超时(' + to / 1000 + 's)'); throw e; } finally { clearTimeout(timer); } },
        callRetry: async function (msgs, opts) { opts = opts || {}; var retries = opts.retries != null ? opts.retries : (RT.api.retries || 2); var delay = opts.delay || 2000, to = opts.timeout || RT.api.timeoutMs; var lastErr; for (var i = 0; i <= retries; i++) { if (i > 0) { _log('重试' + i); await _sleep(delay); } try { return await this.callTO(msgs, to); } catch (e) { lastErr = e; if (/401|403/.test(e.message)) break; } } throw lastErr; },
        callMainRetry: async function (msgs, opts) { opts = opts || {}; var retries = opts.retries || 2, delay = opts.delay || 2000, lastErr; for (var i = 0; i <= retries; i++) { if (i > 0) await _sleep(delay); try { return await this.callMain(msgs); } catch (e) { lastErr = e; } } throw lastErr; }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §9  关键词扫描器 (ContextScanner)                      ║
    // ╚═══════════════════════════════════════════════════════╝

    var ContextScanner = {
        buildScanText: function (depth) {
            var msgs = _getChatArray() || [];
            var start = Math.max(0, msgs.length - (depth || 10));
            var recent = msgs.slice(start);
            var texts = [];
            recent.forEach(function (m) {
                var text = _processMessageText(m.mes || m.message || m.content || '');
                if (text) texts.push(text);
            });
            return texts.join('\n\n');
        },
        scan: function (entries, text) {
            var triggered = [];
            entries.forEach(function (e) {
                if (_isCon(e)) {
                    triggered.push(e);
                } else {
                    var keys = _getKeys(e);
                    if (keys) {
                        var keyList = keys.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
                        for (var i = 0; i < keyList.length; i++) {
                            var key = keyList[i];
                            if (key && text.toLowerCase().indexOf(key.toLowerCase()) !== -1) {
                                triggered.push(e);
                                break;
                            }
                        }
                    }
                }
            });
            return triggered;
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §10  提示词构建（全量内容模式）                         ║
    // ╚═══════════════════════════════════════════════════════╝

    var Prompt = {
        /**
         * 构建元数据摘要（轻量，不含 content）
         */
        buildSummary: async function (bk) {
            var entries = await Book.getEntries(bk);
            var vis = entries.filter(function (e) { return e.comment !== FMT_COMMENT; });
            if (RT.cfg.excludeConstantFromPrompt) vis = vis.filter(function (e) { return !_isCon(e); });
            // ★ directTriggerOnly: 仅保留常量条目 + 被聊天文本直接关键词触发的条目
            if (RT.cfg.directTriggerOnly) {
                var _scanText = ContextScanner.buildScanText(RT.cfg.reviewDepth || 10);
                if (_scanText) {
                    vis = ContextScanner.scan(vis, _scanText);
                }
            }
            if (vis.length === 0) return '（世界书为空）';
            vis = _sort(vis);
            var lines = ['共 ' + vis.length + ' 个条目：'];
            vis.forEach(function (e, i) {
                var mode = _isCon(e) ? '🔵永久' : '🟢关键词'; var st = _isOn(e) ? '启用' : '禁用';
                var dep = _dep(e); dep = dep != null ? dep : '?';
                lines.push((i + 1) + '. ' + _dn(e) + ' [' + mode + ' ' + st + ' d:' + dep + ' o:' + _ord(e) + '] keys:' + (_getKeys(e) || '无'));
            });
            return lines.join('\n');
        },

        /**
         * 构建全量上下文（含 content 正文）—— AI 可直接查看所有内容
         */
        buildFullContext: async function (bk) {
            var entries = await Book.getEntries(bk);
            var vis = entries.filter(function (e) { return e.comment !== FMT_COMMENT; });
            if (RT.cfg.excludeConstantFromPrompt) vis = vis.filter(function (e) { return !_isCon(e); });
            // ★ directTriggerOnly: 仅保留常量条目 + 被聊天文本直接关键词触发的条目
            if (RT.cfg.directTriggerOnly) {
                var _scanText = ContextScanner.buildScanText(RT.cfg.reviewDepth || 10);
                if (_scanText) {
                    vis = ContextScanner.scan(vis, _scanText);
                }
            }
            if (vis.length === 0) return '（世界书为空，尚无任何条目）';
            vis = _sort(vis);

            var maxChars = RT.cfg.maxContentChars || 0;
            var blueC = 0, greenC = 0, enC = 0, disC = 0;
            vis.forEach(function (e) { if (_isCon(e)) blueC++; else greenC++; if (_isOn(e)) enC++; else disC++; });

            var lines = [];
            lines.push('共 ' + vis.length + ' 个条目（🔵永久:' + blueC + ' 🟢关键词:' + greenC + ' 启用:' + enC + ' 禁用:' + disC + '）');
            if (RT.cfg.excludeConstantFromPrompt) lines.push('（注意：蓝灯永久条目已被过滤，不在此列表中）');
            if (RT.cfg.directTriggerOnly) lines.push('（注意：仅包含直接触发的条目，递归触发的条目已被排除）');
            lines.push('════════════════════════════════════');

            vis.forEach(function (e, i) {
                var mode = _isCon(e) ? '🔵永久' : '🟢关键词';
                var st2 = _isOn(e) ? '✅启用' : '❌禁用';
                var dep = _dep(e); dep = dep != null ? dep : '?';
                var skeys = _getSecondaryKeys(e);
                var uid = Book.uid(e) || '?';

                lines.push('');
                var isLocked = RT.cfg.entryLockEnabled && Store.loadLockedEntries(bk).indexOf(_dn(e)) !== -1;
                var isAI = RT.cfg.aiRegistryEnabled && AIRegistry.isAIManaged(bk, _dn(e));
                var tagStr = '';
                if (isLocked) tagStr += '🔒';
                if (isAI) tagStr += '🤖';
                lines.push('── 条目 #' + (i + 1) + (tagStr ? ' ' + tagStr : '') + ' ──');
                lines.push('名称: ' + _dn(e));
                lines.push('状态: ' + mode + ' ' + st2 + ' | 深度:' + dep + ' 排序:' + _ord(e) + ' UID:' + uid);
                lines.push('主关键词: ' + (_getKeys(e) || '（无）'));
                if (skeys) lines.push('副关键词: ' + skeys);

                var content = e.content || '（空）';
                if (maxChars > 0 && content.length > maxChars) {
                    content = content.substring(0, maxChars) + '\n…（已截断至' + maxChars + '字符）';
                }
                lines.push('内容:');
                lines.push(content);

                var extras = [];
                if (e.sticky != null) extras.push('粘性:' + e.sticky);
                if (e.cooldown != null) extras.push('冷却:' + e.cooldown);
                if (e.delay != null) extras.push('延迟:' + e.delay);
                if (e.prevent_recursion || e.preventRecursion) extras.push('阻止递归');
                if (e.excludeRecursion) extras.push('不可递归');
                if (e.vectorized) extras.push('向量化');
                if (e.group) extras.push('分组:' + e.group);
                if (e.probability != null && e.probability !== 100) extras.push('概率:' + e.probability + '%');
                if (extras.length > 0) lines.push('属性: ' + extras.join(' | '));
                if (isLocked) lines.push('⚠ 此条目已锁定，请勿修改或删除。');
            });

            lines.push('');
            lines.push('════════════════════════════════════');
            return lines.join('\n');
        },

        /**
         * 构建发送给 AI 的完整消息列表
         */
        buildMsgs: async function (bk) {
            // 根据配置选择上下文模式
            var contextStr;
            if (RT.cfg.contextMode === 'summary') {
                contextStr = await this.buildSummary(bk);
            } else if (RT.cfg.contextMode === 'triggered') {
                contextStr = await this.buildTriggeredContext(bk);
            } else {
                contextStr = await this.buildFullContext(bk);
            }

            var active = RT.promptEntries.filter(function (pe) { return pe.enabled; });
            active.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
            var history = this.getHistory(RT.cfg.reviewDepth);

            var preMsgs = [], postMsgs = [];
            active.forEach(function (pe) {
                var content = (pe.content || '')
                    .replace(/\{current_worldbook_summary\}/g, contextStr)
                    .replace(/\{current_worldbook_context\}/g, contextStr);
                if (!content.trim()) return;
                if (pe.role === 'user' && pe.order >= 800) postMsgs.push({ role: 'user', content: content });
                else preMsgs.push({ role: pe.role || 'system', content: content });
            });

            // ★ 锁定提示注入
            if (RT.cfg.entryLockEnabled) {
                var lockedNames = Store.loadLockedEntries(bk);
                if (lockedNames.length > 0) {
                    var lockMsg = '【重要】以下条目已被用户锁定，你绝对不可以修改、删除或重命名它们：\n' +
                        lockedNames.map(function (n) { return '- ' + n; }).join('\n');
                    preMsgs.push({ role: 'system', content: lockMsg });
                }
            }

            return preMsgs.concat(history).concat(postMsgs);
        },

        getHistory: function (count) {
            var msgs = [];
            var chat = _getChatArray();
            var sendUser = RT.cfg.sendUserMessages !== false;
            var sendAi = RT.cfg.sendAiMessages !== false;

            if (chat && chat.length > 0) {
                var start = Math.max(0, chat.length - count);
                for (var i = start; i < chat.length; i++) {
                    var m = chat[i];
                    if (_isBool(m.is_system, true)) continue;
                    var isUser = _isBool(m.is_user, true);
                    if (isUser && !sendUser) continue;
                    if (!isUser && !sendAi) continue;
                    var rawContent = m.mes || m.message || m.content || '';
                    if (!rawContent) continue;

                    var text = _processMessageText(rawContent);
                    text = Parser.strip(text);
                    if (!text) { text = _stripHtml(rawContent); text = Parser.strip(text); }
                    if (text) msgs.push({ role: isUser ? 'user' : 'assistant', content: text });
                }
                if (msgs.length > 0) return msgs;
            }

            // DOM 回退
            try {
                var els = document.querySelectorAll('#chat .mes');
                if (els && els.length > 0) {
                    var s2 = Math.max(0, els.length - count);
                    for (var j = s2; j < els.length; j++) {
                        var el = els[j];
                        var ua = el.getAttribute('is_user');
                        var isU2 = (ua === 'true' || ua === '1');
                        if (isU2 && !sendUser) continue;
                        if (!isU2 && !sendAi) continue;
                        var te = el.querySelector('.mes_text');
                        var raw = te ? te.innerHTML : '';
                        if (!raw) continue;
                        var t2 = _processMessageText(raw);
                        t2 = Parser.strip(t2);
                        if (!t2) { t2 = _stripHtml(raw); t2 = Parser.strip(t2); }
                        if (t2) msgs.push({ role: isU2 ? 'user' : 'assistant', content: t2 });
                    }
                }
            } catch (e) { _warn('DOM历史获取失败: ' + e.message); }

            if (msgs.length === 0) {
                if (!sendUser && !sendAi) {
                    _warn('getHistory: user/AI 消息均被禁止发送，无可用聊天记录');
                } else {
                    _warn('getHistory: 未获取到消息 (count=' + count + ')');
                }
            }
            return msgs;
        },

        /**
         * 构建触发模式的上下文（仅包含被关键词激活的条目）
         */
        buildTriggeredContext: async function (bk) {
            var entries = await Book.getEntries(bk);
            var vis = entries.filter(function (e) { return e.comment !== FMT_COMMENT; });
            if (RT.cfg.excludeConstantFromPrompt) vis = vis.filter(function (e) { return !_isCon(e); });
            // triggered 模式已通过 ContextScanner.scan() 实现非递归扫描，无需额外过滤
            var scanText = ContextScanner.buildScanText(RT.cfg.reviewDepth || 10);
            var triggered = [];
            
            if (scanText) {
                triggered = ContextScanner.scan(vis, scanText);
            } else {
                triggered = vis;
            }
            
            var lines = ['# 世界书条目（触发模式）\n\n共 ' + triggered.length + ' 个被激活的条目：\n'];
            triggered.forEach(function (e, i) {
                var name = _dn(e);
                var keys = _getKeys(e);
                var content = e.content || '';
                if (RT.cfg.maxContentChars > 0) {
                    content = content.substring(0, RT.cfg.maxContentChars);
                }
                lines.push('## ' + (i + 1) + '. ' + name + '\n');
                if (keys) lines.push('- 关键词: ' + keys + '\n');
                lines.push('- 深度: ' + (_dep(e) || 4) + ' | 排序: ' + (_ord(e) || 200) + ' | 模式: ' + (_isCon(e) ? '永久' : '关键词') + '\n');
                lines.push('\n' + content + '\n\n');
            });
            return lines.join('');
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §11  格式指导条目                                     ║
    // ╚═══════════════════════════════════════════════════════╝

    var FmtGuide = {
        _getFormatContent: function () { var fe = RT.promptEntries.find(function (pe) { return pe.id === '_sys_format'; }); return fe ? fe.content : ''; },
        ensure: async function (bk) {
            var entries = await Book.getEntries(bk);
            for (var i = 0; i < entries.length; i++) { if (entries[i].comment === FMT_COMMENT) return entries[i]; }
            if (!RT.depsL2) return null;
            var entry = Book._full({ name: '[' + P + '] 格式指导', comment: FMT_COMMENT, content: this._getFormatContent(), enabled: false, constant: true, selective: false, keys: '', order: 1, depth: 100, prevent_recursion: true, delay_until_recursion: true });
            entry.comment = FMT_COMMENT; await WI.addLorebookEntry(bk, entry);
            var updated = await Book.getEntries(bk);
            for (var j = 0; j < updated.length; j++) { if (updated[j].comment === FMT_COMMENT) return updated[j]; } return null;
        },
        enable: async function (bk) {
            if (!RT.depsL2) return; var entries = await Book.getEntries(bk); var t = null;
            for (var i = 0; i < entries.length; i++) { if (entries[i].comment === FMT_COMMENT) { t = entries[i]; break; } }
            if (!t) { t = await this.ensure(bk); if (!t) return; }
            if (_isOn(t)) { RT.formatEntryEnabled = true; return; }
            var u = {}; for (var k in t) u[k] = t[k]; u.enabled = true; await Book.updateEntry(bk, u); RT.formatEntryEnabled = true;
            await _syncAfterWrite(bk);
        },
        disable: async function (bk) {
            if (!RT.depsL2) return; var entries = await Book.getEntries(bk); var t = null;
            for (var i = 0; i < entries.length; i++) { if (entries[i].comment === FMT_COMMENT) { t = entries[i]; break; } }
            if (!t || !_isOn(t)) { RT.formatEntryEnabled = false; return; }
            var u = {}; for (var k in t) u[k] = t[k]; u.enabled = false; await Book.updateEntry(bk, u); RT.formatEntryEnabled = false;
            await _syncAfterWrite(bk);
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §11  调度器                                           ║
    // ╚═══════════════════════════════════════════════════════╝

    function _buildResultSummary(res) {
        var ok = 0, err = 0, skip = 0, queued = 0, errMsgs = [];
        res.forEach(function (r) {
            if (r.status === 'ok') ok++;
            else if (r.status === 'queued') queued++;  // ★ 新增
            else if (r.status === 'error') { err++; errMsgs.push(r.entry_name + ':' + (r.reason || '?')); }
            else skip++;
        });
        var txt = '';
        if (ok > 0) txt += '✅' + ok;
        if (queued > 0) txt += (txt ? ' ' : '') + '📋' + queued + '条待审核';  // ★ 新增
        if (err > 0) txt += (txt ? ' ' : '') + '❌' + err;
        if (skip > 0) txt += (txt ? ' ' : '') + '⏭' + skip;
        if (errMsgs.length > 0) txt += '\n' + errMsgs.join('\n');
        if (!txt) txt = '无操作';
        return { ok: ok, err: err, skip: skip, queued: queued, text: txt };  // ★ 新增 queued
    }

    var Sched = {
        isUp: function (fl) { var s = RT.cfg.startAfter, i = RT.cfg.interval; if (fl <= s) return false; if (i === 0) return true; if (i < 0) return false; return (fl - s) % i === 0; },
        nextUp: function (fl) { var s = RT.cfg.startAfter, i = RT.cfg.interval; if (i === 0) return fl < s ? s + 1 : fl + 1; if (i < 0) return 999999; if (fl < s) return s + i; return s + (Math.floor((fl - s) / i) + 1) * i; },
        preEnable: function (fl) { return (this.nextUp(fl) - fl) === 1; },

        _onNewLock: false,

        onBeforeGenerate: async function () {
            if (RT.processing || !RT.cfg.autoEnabled || !RT.depsL0) return;
            if (RT.cfg.mode !== 'inline' || !RT.depsL2) return;
            var af = _aiFloor();
            var nextFloor = af + 1;
            if (this.isUp(nextFloor)) {
                try {
                    var bk = await Book.getTargetBookName();
                    if (bk) {
                        await FmtGuide.ensure(bk);
                        await FmtGuide.enable(bk);
                        _log('onBeforeGenerate: 预启用格式条目 (目标楼 ' + nextFloor + ')');
                    }
                } catch (e) { _warn('预启用格式条目失败: ' + e.message); }
            }
        },

        onMessageDeleted: async function (data) {
            var newFloor = _aiFloor();
            _log('onMessageDeleted: 楼层 ' + RT.lastAiFloor + ' → ' + newFloor);

            // ★ 楼层减少 → 重算调度状态
            if (newFloor < RT.lastAiFloor) {
                // 如果上次处理的楼层高于当前楼层，说明已被删除的消息触发了更新
                if (RT.lastProcessedAiFloor > newFloor) {
                    RT.lastProcessedAiFloor = 0;
                }
                RT.lastAiFloor = newFloor;
                RT.nextUpdateAiFloor = this.nextUp(newFloor);
                _log('楼层重算: 上次=' + RT.lastProcessedAiFloor + ' 下次=' + RT.nextUpdateAiFloor);
            }

            // 快照回滚
            if (RT.cfg.syncOnDelete) {
                var fl = null;
                if (data != null) {
                    fl = (typeof data === 'number') ? data : (data.messageIndex != null ? data.messageIndex : (data.id != null ? data.id : null));
                }
                if (fl != null) {
                    try {
                        var chatId = _getChatId();
                        var result = await SnapshotStore.rollback(fl, chatId);
                        if (result.rolled > 0) {
                            Toast.show('🔄 已回滚 ' + result.rolled + ' 条世界书操作', 'info');
                            SnapshotStore.adjustFloors(fl);
                        }
                    } catch (e) {
                        _warn('回滚失败: ' + e.message);
                    }
                }
            }

            if (typeof UI !== 'undefined' && UI.status) UI.status();
        },

        onNew: async function () {
            checkDeps();
            if (this._onNewLock || RT.processing || !RT.cfg.autoEnabled || !RT.depsL0) return;
            var af = _aiFloor();
            if (af <= 0 || af <= RT.lastAiFloor) return;

            this._onNewLock = true;
            RT.lastAiFloor = af;
            RT.nextUpdateAiFloor = this.nextUp(af);
            if (typeof UI !== 'undefined' && UI.status) UI.status();

            try {
                if (RT.cfg.mode === 'inline') await this._inline(af);
                else await this._external(af);
            } catch (e) {
                _err('Sched', e);
                if (typeof UI !== 'undefined' && UI.status) UI.status('❌ ' + e.message);
            } finally {
                this._onNewLock = false;
            }
        },

        _inline: async function (fl) {
            var bk = await Book.getTargetBookName();
            if (!bk) return;
            var preEnabled = false;
            try {
                if (RT.depsL2 && this.preEnable(fl)) {
                    await FmtGuide.ensure(bk);
                    await FmtGuide.enable(bk);
                    preEnabled = true;
                }
                if (!this.isUp(fl)) return;
                var lastText = this._getLastAiMessage();
                if (!lastText) return;
                RT.processing = true;
                var toast = Toast.persistent('🌍 世界正在更新中…', 'info');
                try {
                    var cmds = Parser.parse(lastText);
                    this._saveDebug(fl, 'inline', '(世界书注入)', lastText, cmds);
                    if (cmds.length > 0 && RT.depsL2) {
                        var res = await Router.execute(cmds, bk, { floor: fl, rawReply: lastText });  // ★ 传递 opts
                        var sm = _buildResultSummary(res);
                        // ★ 只有实际执行（非排队）才剥离 <world_update> 标签
                        if (sm.queued === 0) {
                            try {
                                var lastEl = document.querySelector('#chat .mes:last-child .mes_text');
                                if (lastEl) lastEl.innerHTML = Parser.strip(lastEl.innerHTML);
                            } catch (e) { }
                        }
                        if (sm.queued > 0) {
                            toast.update('📋 AI第' + fl + '楼：' + sm.text, 'info');
                            toast.close(5000);
                        } else {
                            toast.update('🌍 更新完毕 — AI第' + fl + '楼：' + sm.text, sm.err > 0 ? 'warning' : 'success');
                            toast.close(4000);
                        }
                    } else {
                        toast.update('AI第' + fl + '楼：无更新指令', 'info');
                        toast.close(2000);
                    }
                    RT.lastProcessedAiFloor = fl;
                } finally {
                    RT.processing = false;
                    RT.nextUpdateAiFloor = this.nextUp(fl);
                    if (typeof UI !== 'undefined') { UI.status(); UI.refresh(); }
                }
            } finally {
                // 确保格式条目在 isUp 的楼层处理完后被禁用
                // preEnable 的楼层不禁用（需要保持到下一楼）
                if (RT.depsL2 && !preEnabled) {
                    try { await FmtGuide.disable(bk); } catch (e) { _warn('禁用格式条目失败: ' + e.message); }
                }
            }
        },

        _external: async function (fl) {
            if (!this.isUp(fl)) return;
            var bk = await Book.getTargetBookName();
            if (!bk) {
                _warn('无目标世界书，跳过 floor ' + fl);
                return;
            }
            // 重新检查依赖
            checkDeps();
            if (!RT.depsL1) {
                _warn('读取不可用(L1)，跳过 floor ' + fl);
                Toast.show('⚠ 世界书读取不可用，请检查 TavernHelper', 'warning');
                return;
            }
            RT.processing = true;
            var toast = Toast.persistent('🌍 世界正在更新中…（AI第' + fl + '楼）', 'info');
            try {
                var msgs = await Prompt.buildMsgs(bk);
                toast.update('🌍 等待AI响应…', 'info');
                var reply = await API.callRetry(msgs);
                var cmds = Parser.parse(reply);
                this._saveDebug(fl, 'external', msgs, reply, cmds);
                this._saveBackendChat(fl, msgs, reply, cmds);
                if (cmds.length > 0 && RT.depsL2) {
                    toast.update('🌍 写入世界书…（' + cmds.length + '条）', 'info');
                    var res = await Router.execute(cmds, bk, { floor: fl, rawReply: reply });  // ★ 传递 opts
                    var sm = _buildResultSummary(res);
                    if (sm.queued > 0) {
                        toast.update('📋 AI第' + fl + '楼：' + sm.text, 'info');
                    } else {
                        toast.update('🌍 更新完毕 — AI第' + fl + '楼：' + sm.text, sm.err > 0 ? 'warning' : 'success');
                    }
                    toast.close(5000);
                } else if (cmds.length > 0) {
                    toast.update('⚠ 检测到 ' + cmds.length + ' 条指令但写入不可用(L2)，请检查依赖', 'warning');
                    toast.close(5000);
                } else {
                    toast.update('🌍 AI第' + fl + '楼：无需更新', 'info');
                    toast.close(2000);
                    Store.appendLog({ floor: fl, action: 'review', name: '外部审核', status: 'ok', reason: '无需更新' });
                }
                RT.lastProcessedAiFloor = fl;
            } catch (e) {
                _err('External', e);
                toast.update('❌ 失败: ' + e.message, 'error');
                toast.close(6000);
                Store.appendLog({ floor: fl, action: 'error', name: '外部审核', status: 'error', reason: e.message });
            } finally {
                RT.processing = false;
                RT.nextUpdateAiFloor = this.nextUp(fl);
                if (typeof UI !== 'undefined') { UI.status(); UI.refresh(); }
            }
        },

        manual: async function () {
            if (!RT.depsL0) { Toast.show('依赖未就绪', 'error'); return; }
            if (RT.processing) { Toast.show('正在处理中，请稍候', 'warning'); return; }  // ★ 新增并发保护
            var bk = await Book.getTargetBookName(); if (!bk) { Toast.show('无目标世界书', 'error'); return; }
            if (!RT.depsL1) { Toast.show('读取不可用', 'error'); return; }
            var fl = _aiFloor(); RT.lastAiFloor = fl; RT.processing = true;
            var toast = Toast.persistent('🌍 手动更新中…', 'info');
            try {
                var msgs = await Prompt.buildMsgs(bk);
                toast.update('🌍 等待AI…', 'info');
                var reply = RT.cfg.mode === 'inline' ? await API.callMainRetry(msgs) : await API.callRetry(msgs);
                var cmds = Parser.parse(reply);
                this._saveDebug(fl, 'manual', msgs, reply, cmds);
                this._saveBackendChat(fl, msgs, reply, cmds);
                if (cmds.length > 0 && RT.depsL2) {
                    var res = await Router.execute(cmds, bk, { floor: fl, rawReply: reply, isManual: true });  // ★ 传递 opts
                    var sm = _buildResultSummary(res);
                    if (sm.queued > 0) {
                        toast.update('📋 手动：' + sm.text, 'info');
                        // 自动打开审核队列界面
                        if (typeof UI !== 'undefined' && UI.open && UI.refresh) {
                            UI.open();
                            // 切换到第一个标签页（世界书编辑器）
                            var tabs = document.querySelectorAll('#' + P + '-panel .wbm-tab');
                            if (tabs && tabs.length > 0) {
                                tabs[0].click();
                            }
                            // 等待UI刷新后显示审核队列
                            setTimeout(function() {
                                if (typeof UI._showPendingQueue === 'function') {
                                    var panel = document.querySelector('#' + P + '-panel .wbm-tp.active');
                                    if (panel) {
                                        UI._showPendingQueue(panel);
                                    }
                                }
                            }, 500);
                        }
                    } else {
                        toast.update('🌍 手动完毕：' + sm.text, sm.err > 0 ? 'warning' : 'success');
                    }
                    toast.close(5000);
                } else if (cmds.length > 0) {
                    toast.update('⚠ 写入不可用(L2)', 'warning'); toast.close(3000);
                } else {
                    toast.update('🌍 手动：无需更新', 'info'); toast.close(2000);
                }
            } catch (e) {
                _err('Manual', e);
                toast.update('❌ 失败: ' + e.message, 'error'); toast.close(6000);
            } finally { RT.processing = false; if (typeof UI !== 'undefined') UI.refresh(); }
        },

        _getLastAiMessage: function () {
            var chat = _getChatArray();
            if (chat && chat.length > 0) { for (var i = chat.length - 1; i >= 0; i--) { var m = chat[i]; if (!m.is_user && !m.is_system) return m.mes || m.message || m.content || ''; } }
            try { var last = document.querySelector('#chat .mes:last-child'); if (last && last.getAttribute('is_user') !== 'true') { var te = last.querySelector('.mes_text'); return te ? te.innerHTML : ''; } } catch (e) { }
            return null;
        },
        _saveDebug: function (fl, mode, sent, received, parsed) { RT.lastDebug = { floor: fl, mode: mode, time: Date.now(), sent: sent, received: received, parsed: parsed }; RT.debugHistory.unshift(RT.lastDebug); if (RT.debugHistory.length > 20) RT.debugHistory.length = 20; },
        _saveBackendChat: function (fl, msgs, reply, cmds) { RT.backendChats.unshift({ floor: fl, time: Date.now(), messages: msgs, reply: reply, commands: cmds }); if (RT.backendChats.length > 30) RT.backendChats.length = 30; }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §12  依赖检测                                         ║
    // ╚═══════════════════════════════════════════════════════╝

    function checkDeps() {
        RT.depsMissing = { L0: [], L1: [], L2: [], L3: [] };

        // L0: SillyTavern 基础环境
        if (typeof SillyTavern === 'undefined') RT.depsMissing.L0.push('SillyTavern');

        // L1/L2: 世界书读写
        // 有 WI 代理层后，只要 SillyTavern 存在即可（NativeWI 通过 REST API 工作）
        if (RT.depsMissing.L0.length > 0) {
            RT.depsMissing.L1.push('SillyTavern 不可用');
            RT.depsMissing.L2.push('SillyTavern 不可用');
        }

        // L3: 内置生成（仅 tavern 模式需要）
        var hasGen = false;
        try {
            if (typeof TavernHelper !== 'undefined' && typeof TavernHelper.generateRaw === 'function') hasGen = true;
        } catch (e) {}
        if (!hasGen) RT.depsMissing.L3.push('generateRaw（使用外部API可忽略）');

        RT.depsL0 = RT.depsMissing.L0.length === 0;
        RT.depsL1 = RT.depsL0 && RT.depsMissing.L1.length === 0;
        RT.depsL2 = RT.depsL1 && RT.depsMissing.L2.length === 0;
        RT.depsL3 = RT.depsL0 && RT.depsMissing.L3.length === 0;

        // 同时刷新 WI 后端选择（TavernHelper 可能延迟加载）
        if (typeof WI !== 'undefined') WI.reinit();
    }

    var _depsRecheckTimer = null;
    function startDepsRecheck() {
        if (_depsRecheckTimer) return;
        var recheckCount = 0;
        _depsRecheckTimer = setInterval(function () {
            checkDeps();
            // WI 延迟重检也在这里统一处理，避免两个定时器做同样的事
            if (WI._backend === 'native') {
                WI._detectBackend();
            }
            recheckCount++;
            if ((RT.depsL0 && WI._backend === 'tavernHelper') || recheckCount >= 20) {
                clearInterval(_depsRecheckTimer);
                _depsRecheckTimer = null;
                if (RT.depsL0) _log('依赖就绪，停止重检');
                else _warn('重检结束，部分依赖未就绪');
                // 同时停止 WI 自己的重检
                WI._stopReinit();
            }
        }, 3000);
    }

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §13  MutationObserver 监听                            ║
    // ╚═══════════════════════════════════════════════════════╝

    var _observer = null;

    function startObserver() {
        if (_observer) return;
        var chatEl = document.querySelector('#chat');
        if (!chatEl) { setTimeout(startObserver, 2000); return; }

        var debounceTimer = null;
        _observer = new MutationObserver(function () {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                // 检测聊天切换
                var cid = _getChatId();
                if (cid && RT._lastChatId && cid !== RT._lastChatId) {
                    _log('检测到聊天切换: ' + RT._lastChatId + ' → ' + cid);
                    RT.lastAiFloor = 0;
                    RT.lastProcessedAiFloor = 0;
                    RT.nextUpdateAiFloor = 0;
                    // ★ 清理临时数据
                    RT.backendChats = [];
                    RT.debugHistory = [];
                    RT.lastDebug = null;
                }
                RT._lastChatId = cid;

                var af = _aiFloor();

                // ★ 楼层增加 → 触发更新检测
                if (af > RT.lastAiFloor) {
                    Sched.onNew();
                }
                // ★ 楼层减少 → 调度状态重算（消息被删除）
                else if (af < RT.lastAiFloor) {
                    Sched.onMessageDeleted(null);
                }
            }, 1500);
        });

        _observer.observe(chatEl, { childList: true, subtree: false });
        _log('MutationObserver 已启动');

        // 验证性日志：首次检测
        setTimeout(function () {
            var af = _aiFloor();
            _log('Observer 启动验证: 当前AI楼=' + af + ' lastAiFloor=' + RT.lastAiFloor + ' depsL2=' + RT.depsL2 + ' autoEnabled=' + RT.cfg.autoEnabled);
        }, 3000);
    }

// ╔═══════════════════════════════════════════════════════╗
// ║  §14  菜单入口                                         ║
// ╚═══════════════════════════════════════════════════════╝

var MENU_ID = P + '-menu-container';
var MENU_ITEM_ID = P + '-menu-item';

var WBM_ICON_SVG = '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M0 0 C-1.22364819 7.04376053 -3.07433483 13.63514055 -5.4375 20.375 C-8.00215906 27.85707661 -10.31816229 35.26354652 -12 43 C-11.29423828 41.84371094 -11.29423828 41.84371094 -10.57421875 40.6640625 C-9.95160156 39.66117188 -9.32898438 38.65828125 -8.6875 37.625 C-8.07261719 36.62726563 -7.45773437 35.62953125 -6.82421875 34.6015625 C-5 32 -5 32 -2 30 C0.47595979 41.70453721 -4.38424295 51.74540392 -9.7578125 61.8984375 C-14.92510438 71.42237687 -19.93516 80.55352631 -27.56640625 88.36328125 C-28.27603516 89.17345703 -28.27603516 89.17345703 -29 90 C-29 90.66 -29 91.32 -29 92 C-26.74804937 90.73252511 -24.49844253 89.46117132 -22.25 88.1875 C-21.61578125 87.83107422 -20.9815625 87.47464844 -20.328125 87.10742188 C-17.65337878 85.58894616 -15.12865753 84.09735662 -12.671875 82.23828125 C-11 81 -11 81 -9 81 C-10.36322473 90.59434112 -18.09519417 99.54171946 -25 106 C-29.77640982 109.97936654 -34.83687914 113.54402957 -40 117 C-40.59119629 117.39670898 -41.18239258 117.79341797 -41.79150391 118.20214844 C-48.30960316 122.47878774 -54.34674853 125.24427296 -62 126.625 C-72.04074781 128.50451885 -77.56106995 135.58494941 -84 143 C-87.07020266 146.45845786 -89.83530382 148.06816408 -94.125 149.8125 C-95.70667969 150.47185547 -95.70667969 150.47185547 -97.3203125 151.14453125 C-98.20460938 151.42683594 -99.08890625 151.70914063 -100 152 C-100.66 151.67 -101.32 151.34 -102 151 C-101.21689453 150.195625 -101.21689453 150.195625 -100.41796875 149.375 C-93.8098902 142.33872721 -88.39561424 134.71820709 -83.14550781 126.63378906 C-82 125 -82 125 -79.9921875 123.0859375 C-78.78560924 121.08421981 -78.78560924 121.08421981 -79.37890625 119.08764648 C-80.16544883 116.68458202 -81.06877466 114.3505703 -82 112 C-82.53318551 110.44471401 -83.05678813 108.88610672 -83.5703125 107.32421875 C-83.82683594 106.55916016 -84.08335937 105.79410156 -84.34765625 105.00585938 C-84.60417969 104.24080078 -84.86070312 103.47574219 -85.125 102.6875 C-85.38925781 101.90310547 -85.65351563 101.11871094 -85.92578125 100.31054688 C-86.17972656 99.55193359 -86.43367188 98.79332031 -86.6953125 98.01171875 C-86.92234863 97.33584717 -87.14938477 96.65997559 -87.38330078 95.96362305 C-90.65498749 85.5462928 -89.69203976 75.21597914 -85.97265625 65.09765625 C-85.65167969 64.40542969 -85.33070313 63.71320313 -85 63 C-84.67 63 -84.34 63 -84 63 C-83.71673572 64.61953276 -83.47556395 66.24642826 -83.25 67.875 C-82.23471231 73.89643699 -79.99903792 78.72306687 -77 84 C-76.67 83.67 -76.34 83.34 -76 83 C-76.40802652 80.9476875 -76.87927865 78.90791234 -77.375 76.875 C-80.27602729 63.65920903 -81.41157338 51.48428173 -75.56640625 38.91796875 C-73.41542638 34.82520656 -71.45047545 31.13212802 -68 28 C-67.89042969 28.9178125 -67.78085937 29.835625 -67.66796875 30.78125 C-67.50941406 32.0084375 -67.35085938 33.235625 -67.1875 34.5 C-67.03667969 35.7065625 -66.88585937 36.913125 -66.73046875 38.15625 C-65.9227717 42.40637781 -64.61669937 45.99590073 -63 50 C-62.63648438 48.96101563 -62.27296875 47.92203125 -61.8984375 46.8515625 C-58.99173463 38.71650597 -55.99922472 31.1209116 -51 24 C-50.58621094 23.37996094 -50.17242187 22.75992188 -49.74609375 22.12109375 C-41.65794371 11.32884578 -25.85434245 5.14950268 -13.04296875 1.96484375 C-4.16918605 0 -4.16918605 0 0 0 Z M-16 13 C-18.15027612 14.80872673 -20.20644078 16.63913343 -22.25 18.5625 C-23.13461914 19.39503296 -23.13461914 19.39503296 -24.03710938 20.24438477 C-25.69935002 21.82153013 -27.35060958 23.40943998 -29 25 C-29.66515625 25.62648438 -30.3303125 26.25296875 -31.015625 26.8984375 C-41.33758301 37.60067818 -44.60216274 58.67519048 -47.79199219 72.77075195 C-51.00367008 86.77275301 -57.25924853 97.76141188 -65.20605469 109.61083984 C-67.33621719 112.54769337 -67.33621719 112.54769337 -68 116 C-63.17482167 115.57424897 -60.36874047 113.25985294 -57 110 C-45.29997697 96.64264152 -41.06234225 81.51550465 -37.5625 64.5 C-34.44220789 49.3311797 -30.03161676 36.04576204 -20 24 C-18.639431 22.3176577 -17.28487659 20.63042645 -15.9375 18.9375 C-15.34839844 18.22464844 -14.75929688 17.51179688 -14.15234375 16.77734375 C-13.58193359 15.89755859 -13.58193359 15.89755859 -13 15 C-13.495 14.01 -13.495 14.01 -14 13 C-14.66 13 -15.32 13 -16 13 Z" fill="currentColor" transform="translate(393,45)"/>' +
    '<path d="M0 0 C3.4375 0.5625 3.4375 0.5625 5.8125 2.125 C7.97288251 5.36557376 8.36937446 7.67934403 8.4375 11.5625 C7.09187601 14.51005732 6.35195456 16.10527272 3.4375 17.5625 C0.50342458 17.84644278 -1.71296384 18.05244001 -4.5625 17.5625 C-7.0625 15.5 -7.0625 15.5 -8.5625 12.5625 C-9.125 9.0625 -9.125 9.0625 -8.5625 5.5625 C-5.94071818 1.8284471 -4.52937793 0.71516494 0 0 Z" fill="currentColor" transform="translate(99.5625,70.4375)"/>' +
    '<path d="M0 0 C2.5 -0.125 2.5 -0.125 5 1 C5.33984375 2.7578125 5.33984375 2.7578125 5.4375 5 C5.76438456 9.87213655 7.0891982 13.14498741 9.90625 17.12890625 C13.29886237 20.16073708 17.07843005 20.63490322 21.48828125 21.26953125 C22.31714844 21.51058594 23.14601562 21.75164062 24 22 C25.1171875 23.8984375 25.1171875 23.8984375 25 26 C22.9494052 27.72657305 20.7389362 28.85302545 18.39453125 30.14453125 C14.68402259 33.01972148 12.68599342 36.58057299 11.42358398 41.03295898 C10.98671248 43.12077845 10.63109394 45.20352537 10.3125 47.3125 C9.08584337 54.82831325 9.08584337 54.82831325 8 57 C5.66015625 57.046875 5.66015625 57.046875 3 56 C1.56170552 53.71547405 0.49171374 51.70073688 -0.5625 49.25 C-2.58006782 44.73738892 -4.47522283 40.5504586 -8 37 C-10.77264882 35.77546924 -10.77264882 35.77546924 -13.75 35.1875 C-14.73484375 34.95417969 -15.7196875 34.72085938 -16.734375 34.48046875 C-17.85585938 34.24263672 -17.85585938 34.24263672 -19 34 C-18.76953125 31.71875 -18.76953125 31.71875 -18 29 C-16.07421875 27.15625 -16.07421875 27.15625 -13.6875 25.5 C-8.81605291 22.08596105 -5.35420683 18.90734116 -3.76953125 13.046875 C-3.43717709 11.61762073 -3.11837375 10.18515446 -2.8125 8.75 C-1.09392736 1.09392736 -1.09392736 1.09392736 0 0 Z" fill="currentColor" transform="translate(64,79)"/>' +
    '<path d="M0 0 C3.0625 0.125 3.0625 0.125 6 1 C7.125 2.8125 7.125 2.8125 7 5 C5.375 7.375 5.375 7.375 3 9 C0.25 8.5625 0.25 8.5625 -2 7 C-2.4375 4.5 -2.4375 4.5 -2 2 C-1.34 1.34 -0.68 0.68 0 0 Z" fill="currentColor" transform="translate(283,97)"/>' +
    '<path d="M0 0 C23.64742324 -0.55477198 46.24769717 2.76170502 67.1484375 14.55859375 C70.03534309 16.03717197 70.5679404 16.19666844 73.92578125 15.57421875 C74.88355469 15.10371094 75.84132812 14.63320312 76.828125 14.1484375 C77.85808594 13.70886719 78.88804687 13.26929688 79.94921875 12.81640625 C81.04363281 12.32785156 82.13804687 11.83929688 83.265625 11.3359375 C104.87474658 2.00687678 125.42349131 -0.59102466 148.828125 0.1484375 C150.06103271 0.1796167 150.06103271 0.1796167 151.31884766 0.21142578 C161.3101959 0.48541156 171.22925424 1.12397579 180.828125 4.1484375 C181.50375488 4.34566406 182.17938477 4.54289062 182.87548828 4.74609375 C185.25044342 5.63690662 186.9009024 6.48828418 188.828125 8.1484375 C190.67919678 11.78590323 191.54106453 15.56058772 192.453125 19.5234375 C193.00957241 21.69460654 193.57336304 23.86390701 194.14453125 26.03125 C194.4192627 27.08086914 194.69399414 28.13048828 194.97705078 29.21191406 C196.43834913 34.25393832 198.62008334 38.85351109 200.95703125 43.5390625 C201.24449219 44.40015625 201.53195312 45.26125 201.828125 46.1484375 C200.6670086 49.01080876 199.01803756 51.4219055 197.2109375 53.9140625 C196.69184814 54.63198975 196.17275879 55.34991699 195.63793945 56.08959961 C195.08195068 56.85151611 194.52596191 57.61343262 193.953125 58.3984375 C193.38102295 59.18677979 192.8089209 59.97512207 192.21948242 60.78735352 C187.74259865 66.93868894 183.19951487 73.039332 178.61181641 79.10839844 C176.61475294 81.75146972 174.66630952 84.39116071 172.828125 87.1484375 C172.168125 87.1484375 171.508125 87.1484375 170.828125 87.1484375 C169.81896467 88.91435637 169.81896467 88.91435637 168.828125 91.1484375 C167.83933295 92.82177789 166.84164164 94.48995573 165.828125 96.1484375 C174.07688421 93.79164915 181.44970523 90.01726679 189.02929688 86.07373047 C190.4858839 85.32448171 191.95939925 84.60820324 193.4375 83.90234375 C199.61211046 80.82630605 204.28640316 76.3034776 209.2265625 71.57421875 C211.828125 69.1484375 211.828125 69.1484375 214.828125 67.1484375 C215.818125 67.1484375 216.808125 67.1484375 217.828125 67.1484375 C218.58659928 69.78280906 219.10222084 72.2033604 219.515625 74.8984375 C219.639375 75.6812207 219.763125 76.46400391 219.890625 77.27050781 C222.52609612 94.90065118 219.32334584 112.66870916 210.61328125 128.33203125 C205.57720262 136.27735442 200.10015095 139.33553897 191.42602539 142.57788086 C188.14180961 143.85427231 186.06459069 144.8523899 183.84375 147.6328125 C182.39183559 151.22909281 182.73588277 153.46211996 183.828125 157.1484375 C187.34128939 159.7660894 190.50088766 160.63001636 194.765625 161.3984375 C201.4145938 163.0221173 201.4145938 163.0221173 204.078125 165.8984375 C209.18278774 173.00903809 212.96525487 181.25777382 216.75390625 189.12890625 C217.06142822 189.7623999 217.3689502 190.39589355 217.68579102 191.04858398 C218.53087159 192.80047879 219.35968211 194.56019485 220.1875 196.3203125 C221.84674774 199.18053955 222.8282572 200.7484992 225.828125 202.1484375 C228.52978503 201.84329087 228.52978503 201.84329087 230.828125 200.1484375 C232.28992369 197.54610127 232.28992369 197.54610127 233.140625 194.5234375 C233.46675781 193.52054688 233.79289062 192.51765625 234.12890625 191.484375 C234.35964844 190.71351563 234.59039062 189.94265625 234.828125 189.1484375 C237.42440272 191.74471522 237.37121667 193.39257876 237.8984375 197.00390625 C238.07246094 198.18404297 238.24648438 199.36417969 238.42578125 200.58007812 C238.59980469 201.81951172 238.77382813 203.05894531 238.953125 204.3359375 C239.22576172 206.16608398 239.22576172 206.16608398 239.50390625 208.03320312 C241.24643138 220.09331126 241.24643138 220.09331126 240.828125 225.1484375 C238.77040426 227.84476123 236.93260458 228.77266531 233.75 229.85546875 C224.63348259 231.61856882 216.48920731 227.58556451 208.140625 224.39794922 C201.38217655 221.84858755 194.57308367 219.43824985 187.765625 217.0234375 C187.02511902 216.76029755 186.28461304 216.49715759 185.52166748 216.2260437 C174.41393417 212.28933904 163.34263273 208.71668394 151.828125 206.1484375 C150.85617187 205.90738281 149.88421875 205.66632813 148.8828125 205.41796875 C127.22763138 200.60211504 109.37350445 207.06691902 90.02490234 216.40161133 C89.04859863 216.86978271 88.07229492 217.3379541 87.06640625 217.8203125 C86.20055908 218.2440918 85.33471191 218.66787109 84.44262695 219.10449219 C81.57634591 220.24897045 78.88018394 220.74361521 75.828125 221.1484375 C75.828125 221.8084375 75.828125 222.4684375 75.828125 223.1484375 C72.54506139 224.24279204 71.08883283 224.11783713 67.828125 223.1484375 C67.828125 222.4884375 67.828125 221.8284375 67.828125 221.1484375 C65.92402946 220.66445335 64.0174759 220.18855451 62.10107422 219.75585938 C58.46193803 218.78333834 55.24292137 217.08695137 51.890625 215.3984375 C45.89512069 212.47626455 39.87484483 209.91365508 33.578125 207.7109375 C32.8756665 207.4644043 32.17320801 207.21787109 31.44946289 206.96386719 C0.23774935 196.31378365 -35.73482659 213.59505675 -64.70263672 224.79370117 C-66.40015195 225.45963506 -68.09367797 226.13589012 -69.78173828 226.82543945 C-76.29853933 229.42918416 -82.4412013 230.86507899 -89.484375 229.4609375 C-90.30550781 229.31269531 -91.12664062 229.16445313 -91.97265625 229.01171875 C-94.8728843 227.87326334 -95.66310991 226.878155 -97.171875 224.1484375 C-97.14586063 221.61088125 -96.9521556 219.43714877 -96.55737305 216.95410156 C-96.34380577 215.41315695 -96.13047138 213.87218005 -95.91732788 212.33117676 C-95.79574184 211.49665482 -95.67415581 210.66213287 -95.54888535 209.80232239 C-95.0169321 206.05774958 -94.55961092 202.30493707 -94.09588337 198.55140305 C-92.67126861 187.07373055 -91.11752439 175.61369434 -89.52637196 164.15806198 C-88.65608669 157.87866794 -87.81317731 151.59797289 -87.02954102 145.30712891 C-86.26496059 139.17674143 -85.43260844 133.05911369 -84.55206871 126.94434357 C-84.23000674 124.62399776 -83.93229906 122.3001327 -83.65983009 119.97344208 C-81.90710568 105.17283631 -81.90710568 105.17283631 -79.171875 100.1484375 C-75.7651353 97.17851863 -72.15566747 96.51911819 -67.76933289 95.81378174 C-63.7690233 95.07393071 -62.06206572 93.94407183 -59.171875 91.1484375 C-55.95463832 86.32719171 -54.49279261 81.12435853 -54.78515625 75.34765625 C-55.68903131 70.20743747 -58.1602483 66.38487013 -61.421875 62.3984375 C-64.00041642 60.28872179 -65.37102768 59.72985059 -68.3984375 58.69140625 C-70.53710938 57.63916016 -70.53710938 57.63916016 -72.171875 56.1484375 C-72.83673188 52.38226654 -72.04278116 48.92627183 -71.296875 45.2109375 C-70.93187382 43.1263752 -70.56728769 41.04174019 -70.203125 38.95703125 C-70.01492187 37.95397949 -69.82671875 36.95092773 -69.6328125 35.91748047 C-69.24608586 33.59425294 -69.02117882 31.40705807 -68.953125 29.05859375 C-68.79163706 25.66330986 -68.55075263 23.25998373 -67.171875 20.1484375 C-62.75912857 15.93954077 -56.48700801 10.62910666 -50.171875 10.1484375 C-48.73974609 11.74731445 -48.73974609 11.74731445 -47.4453125 14.13671875 C-46.9709375 14.98814453 -46.4965625 15.83957031 -46.0078125 16.71679688 C-45.52570312 17.62236328 -45.04359375 18.52792969 -44.546875 19.4609375 C-43.57796172 21.22920424 -42.60671198 22.99619332 -41.6328125 24.76171875 C-41.20790527 25.55360596 -40.78299805 26.34549316 -40.34521484 27.16137695 C-39.20414002 29.28240032 -39.20414002 29.28240032 -37.171875 31.1484375 C-34.65322811 31.65888332 -34.65322811 31.65888332 -32.171875 31.1484375 C-31.02982809 29.41562407 -31.02982809 29.41562407 -30.609375 27.0234375 C-30.37992187 26.11851562 -30.15046875 25.21359375 -29.9140625 24.28125 C-29.54667969 22.73050781 -29.54667969 22.73050781 -29.171875 21.1484375 C-28.54152609 18.72768581 -27.89515687 16.31105968 -27.234375 13.8984375 C-26.93660156 12.75890625 -26.63882813 11.619375 -26.33203125 10.4453125 C-25.02753774 6.73826698 -23.7656346 4.11650876 -21.171875 1.1484375 C-18.0546875 0.34375 -18.0546875 0.34375 -14.296875 0.2734375 C-13.60416504 0.25571289 -12.91145508 0.23798828 -12.19775391 0.21972656 C-10.67308598 0.18699547 -9.14805539 0.16879996 -7.62304688 0.16308594 C-5.07984197 0.1478875 -2.54205026 0.07654501 0 0 Z M70.828125 20.1484375 C70.828125 85.8184375 70.828125 151.4884375 70.828125 219.1484375 C71.818125 218.8184375 72.808125 218.4884375 73.828125 218.1484375 C74.13594774 215.54178786 74.23198929 213.16820559 74.20907593 210.55603027 C74.2137559 209.7514216 74.21843587 208.94681293 74.22325766 208.11782217 C74.23529828 205.40064989 74.22571542 202.68397358 74.21630859 199.96679688 C74.22037028 198.02740686 74.22570988 196.08801915 74.23223877 194.14863586 C74.24596615 188.86568133 74.24059145 183.58290169 74.23110151 178.29994392 C74.22353289 172.78438961 74.23054271 167.26885077 74.23526001 161.7532959 C74.24072575 152.48898618 74.23350452 143.22474808 74.21923828 133.96044922 C74.20291022 123.23300674 74.20819815 112.50573528 74.2247175 101.77829695 C74.23830909 92.58596563 74.24026345 83.39368594 74.23240149 74.20134783 C74.22771214 68.70326971 74.2271346 63.20527211 74.23701096 57.7071991 C74.24564458 52.53949624 74.23972506 47.37201496 74.22232819 42.20433617 C74.21834398 40.30194149 74.21953014 38.39952833 74.22611618 36.49714088 C74.23424591 33.91145267 74.2241152 31.32648624 74.20907593 28.74084473 C74.21576809 27.97792287 74.22246026 27.21500102 74.22935522 26.42896032 C74.24027432 24.15373394 74.24027432 24.15373394 73.828125 21.1484375 C72.838125 20.8184375 71.848125 20.4884375 70.828125 20.1484375 Z M126.828125 44.1484375 C124.54473902 49.36760545 123.30995323 54.48679291 122.328125 60.0859375 C120.2531438 71.56539622 117.6344943 78.26660639 109.828125 87.1484375 C108.838125 86.4884375 107.848125 85.8284375 106.828125 85.1484375 C103.36394111 85.49485589 101.77882619 86.18130337 98.828125 88.1484375 C98.951875 86.5396875 98.951875 86.5396875 99.078125 84.8984375 C99.14513226 81.16602588 99.14513226 81.16602588 97.140625 78.6484375 C94.94467106 76.89871679 94.94467106 76.89871679 92.38671875 77.296875 C88.39480523 78.62548133 87.20851312 81.26320013 85.0546875 84.71484375 C83.41188155 87.97429632 82.98243156 90.52223327 82.828125 94.1484375 C83.818125 94.1484375 84.808125 94.1484375 85.828125 94.1484375 C87.52679002 92.2252242 87.52679002 92.2252242 89.015625 89.7734375 C89.54542969 88.96132812 90.07523438 88.14921875 90.62109375 87.3125 C91.99049652 85.27031159 91.99049652 85.27031159 91.828125 83.1484375 C92.488125 83.1484375 93.148125 83.1484375 93.828125 83.1484375 C94.488125 87.1084375 95.148125 91.0684375 95.828125 95.1484375 C101.45055617 94.7305776 101.45055617 94.7305776 103.703125 92.5859375 C104.074375 92.1115625 104.445625 91.6371875 104.828125 91.1484375 C105.488125 91.8084375 106.148125 92.4684375 106.828125 93.1484375 C109.37002502 93.3985148 109.37002502 93.3985148 111.828125 93.1484375 C112.158125 92.8184375 112.488125 92.4884375 112.828125 92.1484375 C113.488125 93.7984375 114.148125 95.4484375 114.828125 97.1484375 C115.818125 96.8184375 116.808125 96.4884375 117.828125 96.1484375 C119.27533516 93.33914719 119.96879234 90.57842897 120.7265625 87.5078125 C121.99833374 82.36609717 123.53115027 77.30998347 125.06054688 72.24023438 C126.15860043 68.56125735 127.16313975 64.93661192 127.828125 61.1484375 C130.27630126 63.59661376 129.94143864 69.21794167 130.390625 72.5234375 C130.52919922 73.47605469 130.66777344 74.42867187 130.81054688 75.41015625 C132.13613775 85.0615026 133.27536029 93.87261294 128.765625 102.7734375 C128.12587002 104.13720868 127.48791201 105.50182397 126.8515625 106.8671875 C126.51995117 107.56328125 126.18833984 108.259375 125.84667969 108.9765625 C124.09944663 112.70220615 122.48705113 116.48125285 120.890625 120.2734375 C120.58439209 120.97162598 120.27815918 121.66981445 119.96264648 122.38916016 C118.24334989 126.47218069 117.49025676 129.72167401 117.828125 134.1484375 C118.818125 133.8184375 119.808125 133.4884375 120.828125 133.1484375 C122.05522542 130.84276602 122.05522542 130.84276602 123.02734375 127.9609375 C123.42800049 126.87707764 123.82865723 125.79321777 124.24145508 124.67651367 C124.66193115 123.51224854 125.08240723 122.3479834 125.515625 121.1484375 C128.51548938 113.11192686 131.52566176 105.11902139 135.140625 97.3359375 C135.44121826 96.66884766 135.74181152 96.00175781 136.05151367 95.31445312 C138.03310809 91.14359102 140.20133496 88.02805425 143.828125 85.1484375 C146.40625 84.73046875 146.40625 84.73046875 149.078125 84.9609375 C154.40102936 85.22816608 158.68219694 84.49818912 163.828125 83.1484375 C164.818125 86.1184375 164.818125 86.1184375 165.828125 89.1484375 C167.148125 88.8184375 168.468125 88.4884375 169.828125 88.1484375 C169.42581936 83.45956154 169.42581936 83.45956154 167.703125 79.1484375 C165.66537439 77.84799498 165.66537439 77.84799498 162.328125 78.3984375 C158.87873945 79.07021517 158.87873945 79.07021517 155.828125 80.1484375 C154.26694072 80.21584615 152.7030998 80.23358206 151.140625 80.2109375 C149.92826172 80.19740234 149.92826172 80.19740234 148.69140625 80.18359375 C148.07652344 80.17199219 147.46164063 80.16039062 146.828125 80.1484375 C147.4675 79.5090625 148.106875 78.8696875 148.765625 78.2109375 C151.39661439 74.3043169 151.8763789 70.81941486 151.828125 66.1484375 C150.7826979 64.89648748 150.7826979 64.89648748 148.47265625 64.87109375 C145.79331312 64.91242897 145.79331312 64.91242897 144.02734375 66.58203125 C141.11490934 70.44270012 139.46263229 73.02568502 139.640625 77.9609375 C139.77404297 79.05341797 139.77404297 79.05341797 139.91015625 80.16796875 C139.86955078 81.14830078 139.86955078 81.14830078 139.828125 82.1484375 C138.32299805 83.7722168 138.32299805 83.7722168 136.828125 85.1484375 C136.75295654 84.43413574 136.67778809 83.71983398 136.6003418 82.98388672 C135.42959947 63.6897932 135.42959947 63.6897932 130.828125 45.1484375 C128.81034665 44.2219231 128.81034665 44.2219231 126.828125 44.1484375 Z" fill="currentColor" transform="translate(106.171875,115.8515625)"/>' +
    '<path d="M0 0 C3.95544502 1.84206645 7.18606379 3.67735366 9.5 7.4375 C10.6135099 13.14423826 10.11623962 17.14478444 7.3125 22.2265625 C5.63650619 24.49114937 3.81300925 25.77758212 1.125 26.65234375 C-3.4187603 27.3957163 -7.56927966 27.29063025 -12 26 C-14.91028936 24.11555976 -16.56453695 22.15215968 -18 19 C-18.76475388 14.88857087 -18.29437265 11.29523967 -17.375 7.25 C-15.39026975 4.00225959 -13.07502189 2.25919976 -10 0 C-6.11726305 -1.29424565 -3.99684632 -0.91730899 0 0 Z" fill="currentColor" transform="translate(36,181)"/>' +
    '<path d="M0 0 C0.66 0 1.32 0 2 0 C1.54961229 4.84166786 0.40027839 7.49668287 -3 11 C-3.66 11 -4.32 11 -5 11 C-4.46968862 6.4923533 -2.74778884 3.58045212 0 0 Z" fill="currentColor" transform="translate(253,184)"/>' +
    '<path d="M0 0 C2.5625 0.125 2.5625 0.125 5 1 C5 2.32 5 3.64 5 5 C3.125 6 3.125 6 1 6 C-0.3125 4.1875 -0.3125 4.1875 -1 2 C-0.67 1.34 -0.34 0.68 0 0 Z" fill="currentColor" transform="translate(341,211)"/>' +
    '<path d="M0 0 C1.875 1.125 1.875 1.125 3 3 C3.43702236 5.60187484 3.73283015 8.06892102 3.9375 10.6875 C4.58963318 16.93623591 5.27173571 21.76027722 9 27 C14.10058137 30.93169814 19.22523769 31.85134225 25.5234375 32.8984375 C26.34070313 33.26195312 27.15796875 33.62546875 28 34 C29.23046875 36.88671875 29.23046875 36.88671875 29 40 C26.46484375 41.87109375 26.46484375 41.87109375 22.9375 43.4375 C15.04902404 47.25110617 11.26530316 51.18258706 7.3125 58.9375 C4.91699354 64.39012899 3.93015922 69.89709413 3.2512207 75.78100586 C2.96875 77.7890625 2.96875 77.7890625 2 81 C-0.41015625 82.27734375 -0.41015625 82.27734375 -3 82 C-4.58984375 79.96484375 -4.58984375 79.96484375 -5.9375 76.9375 C-6.44539063 75.84050781 -6.95328125 74.74351562 -7.4765625 73.61328125 C-8.49727443 71.19236193 -9.47110702 68.75117162 -10.3984375 66.29296875 C-13.40603497 58.23127717 -13.40603497 58.23127717 -19.375 52.3125 C-23.42030249 50.07801704 -27.63813328 48.50409197 -32 47 C-32.99 46.34 -33.98 45.68 -35 45 C-35.140625 42.125 -35.140625 42.125 -34 39 C-31.53809402 37.36673555 -29.41298591 36.18354929 -26.75 35 C-18.57890386 31.28443412 -13.95321087 26.03477273 -10 18 C-8.64461545 14.79487567 -7.45641813 11.53148169 -6.2890625 8.25390625 C-4.83549717 4.40117663 -3.61232214 2.08642745 0 0 Z" fill="currentColor" transform="translate(333,226)"/>' +
    '<path d="M0 0 C1.875 1.125 1.875 1.125 3 3 C3.39365568 6.14924548 3.52854531 8.11909116 1.875 10.875 C-0.88090884 12.52854531 -2.85075452 12.39365568 -6 12 C-7.875 10.875 -7.875 10.875 -9 9 C-9.39365568 5.85075452 -9.52854531 3.88090884 -7.875 1.125 C-5.11909116 -0.52854531 -3.14924548 -0.39365568 0 0 Z" fill="currentColor" transform="translate(100,330)"/>' +
    '</svg>';

    function addMenuEntry() {
        var parentDoc;
        try {
            parentDoc = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext && SillyTavern.getContext().document)
                ? SillyTavern.getContext().document
                : (window.parent || window).document;
        } catch (e) {
            parentDoc = document;
        }
        if (!parentDoc) { setTimeout(addMenuEntry, 2000); return; }

        var extensionsMenu = parentDoc.querySelector('#extensionsMenu');
        if (!extensionsMenu) { setTimeout(addMenuEntry, 2000); return; }

        // 已存在则更新绑定
        var existing = parentDoc.querySelector('#' + MENU_ID);
        if (existing) {
            var existingItem = existing.querySelector('#' + MENU_ITEM_ID);
            if (existingItem) {
                // 移除旧事件，重新绑定
                var newItem = existingItem.cloneNode(true);
                existingItem.parentNode.replaceChild(newItem, existingItem);
                newItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    _closeExtMenu(parentDoc, extensionsMenu);
                    setTimeout(function () { _safeToggleUI(); }, 150);
                });
            }
            _log('✓ 菜单项已更新绑定');
            return;
        }

        // 创建新菜单项
        var container = parentDoc.createElement('div');
        container.className = 'extension_container interactable';
        container.id = MENU_ID;
        container.tabIndex = 0;

        var menuItem = parentDoc.createElement('div');
        menuItem.className = 'list-group-item flex-container flexGap5 interactable';
        menuItem.id = MENU_ITEM_ID;
        menuItem.title = '打开动态世界书管理面板';

        // SVG 图标容器
        var iconWrap = parentDoc.createElement('div');
        iconWrap.className = 'extensionsMenuExtensionButton';
        iconWrap.style.cssText = 'width:1.2em;height:1.2em;display:inline-flex;align-items:center;justify-content:center;';
        iconWrap.innerHTML = WBM_ICON_SVG;
        // 调整 SVG 尺寸适配菜单
        var svgEl = iconWrap.querySelector('svg');
        if (svgEl) {
            svgEl.setAttribute('width', '1.2em');
            svgEl.setAttribute('height', '1.2em');
            svgEl.style.cssText = 'width:1.2em;height:1.2em;fill:currentColor;';
        }

        var label = parentDoc.createElement('span');
        label.textContent = '动态世界书';

        menuItem.appendChild(iconWrap);
        menuItem.appendChild(label);
        container.appendChild(menuItem);

        menuItem.addEventListener('click', function (e) {
            e.stopPropagation();
            _closeExtMenu(parentDoc, extensionsMenu);
            setTimeout(function () { _safeToggleUI(); }, 150);
        });

        extensionsMenu.appendChild(container);
        _log('✓ 菜单项已添加');
    }

    /** 关闭扩展菜单 */
    function _closeExtMenu(doc, menu) {
        try {
            var btn = doc.querySelector('#extensionsMenuButton');
            if (btn && menu && menu.offsetParent !== null) {
                btn.click();
            }
        } catch (e) {
            _warn('关闭扩展菜单失败: ' + e.message);
        }
    }

    /** 安全调用 UI.toggle，防止 UI 未定义时崩溃 */
    function _safeToggleUI() {
        try {
            if (typeof UI !== 'undefined' && typeof UI.toggle === 'function') {
                UI.toggle();
            } else {
                _warn('UI 未就绪，无法打开面板');
                Toast.show('⚠ 面板组件尚未加载完毕，请稍后重试', 'warning', 3000);
            }
        } catch (e) {
            _err('打开面板失败', e);
            Toast.show('❌ 打开面板失败: ' + e.message, 'error', 4000);
        }
    }

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §15  UI 系统                                         ║
    // ╚═══════════════════════════════════════════════════════╝

    var UI = {
        _injected: false,

        toggle: function () {
            if (RT.panelOpen) this.close(); else this.open();
        },

        open: function () {
            if (!this._injected) this._inject();
            var panel = document.getElementById(P + '-panel');
            if (panel) { panel.style.display = 'flex'; RT.panelOpen = true; this.refresh(); }
        },

        close: function () {
            var panel = document.getElementById(P + '-panel');
            if (panel) { panel.style.display = 'none'; RT.panelOpen = false; }
        },

        status: function (msg) {
            var el = document.getElementById(P + '-status');
            if (!el) return;
            if (msg) { el.textContent = msg; return; }
            var af = _aiFloor();
            el.textContent = 'AI楼:' + af + ' 下次:' + RT.nextUpdateAiFloor + ' L0:' + (RT.depsL0?'✓':'✗') + ' L1:' + (RT.depsL1?'✓':'✗') + ' L2:' + (RT.depsL2?'✓':'✗');
        },

        refresh: async function () {
            if (!RT.panelOpen) return;
            // 刷新条目列表
            await this._renderEntries();
            this.status();
        },

        _inject: function () {
            if (this._injected) return;

            // 样式
            var style = document.createElement('style');
            style.textContent = '#' + P + '-panel{position:fixed;top:0;right:0;width:480px;max-width:95vw;height:100vh;z-index:10005;background:#402B71;border-left:2px solid #FFF6AE;display:none;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#ECCDEE;font-size:13px;box-shadow:-4px 0 20px rgba(0,0,0,.3);border-radius:0 0 0 8px}'
                + '#' + P + '-panel .wbm-header{padding:12px 16px;border-bottom:1px solid #FFF6AE;display:flex;justify-content:space-between;align-items:center;background:#5A3996;border-radius:0 0 0 8px}'
                + '#' + P + '-panel .wbm-body{flex:1;overflow-y:auto;padding:16px;scrollbar-width:thin;scrollbar-color:#9A63D5 #402B71}'
                + '#' + P + '-panel .wbm-body::-webkit-scrollbar{width:6px}'
                + '#' + P + '-panel .wbm-body::-webkit-scrollbar-track{background:#402B71}'
                + '#' + P + '-panel .wbm-body::-webkit-scrollbar-thumb{background:#9A63D5;border-radius:3px}'
                + '#' + P + '-panel .wbm-body::-webkit-scrollbar-thumb:hover{background:#ECCDEE}'
                + '#' + P + '-panel .wbm-tabs{display:flex;border-bottom:1px solid #FFF6AE;background:#5A3996}'
                + '#' + P + '-panel .wbm-tab{padding:10px 16px;cursor:pointer;border-bottom:2px solid transparent;font-size:12px;transition:all .3s;flex:1;text-align:center}'
                + '#' + P + '-panel .wbm-tab:hover{background:rgba(154,99,213,.1)}'
                + '#' + P + '-panel .wbm-tab.active{border-bottom-color:#9A63D5;color:#9A63D5;background:rgba(154,99,213,.15)}'
                + '#' + P + '-panel .wbm-tp{display:none;padding:12px 0}'
                + '#' + P + '-panel .wbm-tp.active{display:block;animation:fadeIn .3s ease}'
                + '@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'
                + '#' + P + '-panel .wbm-entry{border:1px solid #FFF6AE;border-radius:8px;margin:6px 0;padding:10px 12px;cursor:pointer;transition:all .3s;position:relative;overflow:hidden}'
                + '#' + P + '-panel .wbm-entry:hover{border-color:#9A63D5;transform:translateX(4px);box-shadow:0 2px 8px rgba(154,99,213,.2)}'
                + '#' + P + '-panel .wbm-entry.dis{opacity:.5;filter:grayscale(30%)}'
                + '#' + P + '-panel .wbm-entry.con{border-left:4px solid #9A63D5}'
                + '#' + P + '-panel .wbm-en{font-weight:600;font-size:14px;margin-bottom:4px;display:block}'
                + '#' + P + '-panel .wbm-ek{font-size:11px;color:#ECCDEE;margin:4px 0;display:block;opacity:.8}'
                + '#' + P + '-panel .wbm-ep{font-size:11px;color:#ECCDEE;margin-top:4px;max-height:48px;overflow:hidden;line-height:1.4;opacity:.7}'
                + '#' + P + '-panel .wbm-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}'
                + '#' + P + '-panel .wbm-badge{font-size:10px;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,.1);color:#ECCDEE;border:1px solid #FEE1A1;transition:all .2s}'
                + '#' + P + '-panel .wbm-badge:hover{background:rgba(254,225,161,.2);transform:scale(1.05)}'
                + '#' + P + '-panel .wbm-btn{padding:8px 16px;border-radius:6px;border:1px solid #FEE1A1;background:rgba(0,0,0,.2);color:#ECCDEE;cursor:pointer;font-size:12px;transition:all .3s;font-weight:500}'
                + '#' + P + '-panel .wbm-btn:hover{background:rgba(255,255,255,.1);transform:translateY(-1px);box-shadow:0 2px 8px rgba(154,99,213,.2)}'
                + '#' + P + '-panel .wbm-btn:active{transform:translateY(0)}'
                + '#' + P + '-panel .wbm-btn-p{background:linear-gradient(135deg,rgba(154,99,213,.4),rgba(90,57,150,.4));border-color:#9A63D5;color:#ECCDEE}'
                + '#' + P + '-panel .wbm-btn-p:hover{background:linear-gradient(135deg,rgba(154,99,213,.5),rgba(90,57,150,.5))}'
                + '#' + P + '-panel .wbm-status{font-size:11px;color:#ECCDEE;padding:8px 16px;border-top:1px solid #FEE1A1;background:#5A3996;border-radius:0 0 0 8px;display:flex;justify-content:space-between;align-items:center}'
                + '#' + P + '-panel select,#' + P + '-panel input[type=text],#' + P + '-panel input[type=number],#' + P + '-panel textarea{width:100%;padding:8px 10px;border:1px solid #FEE1A1;border-radius:6px;background:rgba(0,0,0,.2);color:#ECCDEE;font-size:12px;box-sizing:border-box;outline:none;transition:all .3s;font-family:inherit}'
                + '#' + P + '-panel select:focus,#' + P + '-panel input[type=text]:focus,#' + P + '-panel input[type=number]:focus,#' + P + '-panel textarea:focus{border-color:#9A63D5;box-shadow:0 0 0 2px rgba(154,99,213,.2)}'
                + '#' + P + '-panel textarea{min-height:90px;resize:vertical;font-family:monospace}'
                + '#' + P + '-panel label{font-size:12px;font-weight:600;display:block;margin:10px 0 4px;color:#ECCDEE;line-height:1.4}'
                + '#' + P + '-panel .wbm-fg{margin-bottom:14px}'
                + '#' + P + '-panel .wbm-row{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}'
                + '#' + P + '-panel .wbm-row>*{flex:1;min-width:0}'
                + '#' + P + '-panel .wbm-section{font-size:13px;font-weight:700;color:#9A63D5;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #FEE1A1;display:flex;align-items:center;gap:6px}'
                + '#' + P + '-panel .wbm-section::before{content:"";width:4px;height:12px;background:#9A63D5;border-radius:2px}'
                + '#' + P + '-panel .wbm-header{padding:10px 14px;border-bottom:1px solid #FFF6AE;display:flex;justify-content:space-between;align-items:center;background:#5A3996}'
                + '#' + P + '-panel .wbm-body{flex:1;overflow-y:auto;padding:12px}'
                + '#' + P + '-panel .wbm-tabs{display:flex;border-bottom:1px solid #FFF6AE}'
                + '#' + P + '-panel .wbm-tab{padding:8px 14px;cursor:pointer;border-bottom:2px solid transparent;font-size:12px}'
                + '#' + P + '-panel .wbm-tab.active{border-bottom-color:#9A63D5;color:#9A63D5}'
                + '#' + P + '-panel .wbm-tp{display:none;padding:10px 0}'
                + '#' + P + '-panel .wbm-tp.active{display:block}'
                + '#' + P + '-panel .wbm-entry{border:1px solid #FFF6AE;border-radius:6px;margin:4px 0;padding:8px 10px;cursor:pointer;transition:border-color .2s}'
                + '#' + P + '-panel .wbm-entry:hover{border-color:#9A63D5}'
                + '#' + P + '-panel .wbm-entry.dis{opacity:.5}'
                + '#' + P + '-panel .wbm-entry.con{border-left:3px solid #9A63D5}'
                + '#' + P + '-panel .wbm-en{font-weight:600;font-size:13px}'
                + '#' + P + '-panel .wbm-ek{font-size:11px;color:#ECCDEE;margin-top:2px}'
                + '#' + P + '-panel .wbm-ep{font-size:11px;color:#ECCDEE;margin-top:2px;max-height:40px;overflow:hidden}'
                + '#' + P + '-panel .wbm-badges{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}'
                + '#' + P + '-panel .wbm-badge{font-size:10px;padding:1px 5px;border-radius:8px;background:rgba(255,255,255,.08);color:#ECCDEE;border:1px solid #FEE1A1}'
                + '#' + P + '-panel .wbm-btn{padding:6px 12px;border-radius:6px;border:1px solid #FEE1A1;background:rgba(0,0,0,.2);color:#ECCDEE;cursor:pointer;font-size:12px;transition:background .2s}'
                + '#' + P + '-panel .wbm-btn:hover{background:rgba(255,255,255,.08)}'
                + '#' + P + '-panel .wbm-btn-p{background:rgba(154,99,213,.3);border-color:rgba(154,99,213,.5);color:#ECCDEE}'
                + '#' + P + '-panel .wbm-status{font-size:11px;color:#ECCDEE;padding:6px 14px;border-top:1px solid #FEE1A1}'
                + '#' + P + '-panel select,#' + P + '-panel input[type=text],#' + P + '-panel input[type=number],#' + P + '-panel textarea{width:100%;padding:6px 8px;border:1px solid #FEE1A1;border-radius:5px;background:rgba(0,0,0,.2);color:#ECCDEE;font-size:12px;box-sizing:border-box;outline:none}'
                + '#' + P + '-panel textarea{min-height:80px;resize:vertical;font-family:monospace}'
                + '#' + P + '-panel label{font-size:11px;font-weight:600;display:block;margin:8px 0 3px;color:#ECCDEE}'
                + '#' + P + '-panel .wbm-fg{margin-bottom:10px}'
                + '#' + P + '-panel .wbm-row{display:flex;gap:8px}'
                + '#' + P + '-panel .wbm-row>*{flex:1}'
                + '#' + P + '-panel .wbm-section{font-size:12px;font-weight:700;color:#9A63D5;margin:14px 0 6px;padding-bottom:3px;border-bottom:1px solid #FEE1A1}';

            document.head.appendChild(style);

            // 面板
            var panel = document.createElement('div');
            panel.id = P + '-panel';
            panel.innerHTML = '<div class="wbm-header"><div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-feather-pointed" style="color:#8af"></i><b>动态世界书 v2</b></div><button class="wbm-btn" id="' + P + '-close">✕</button></div>'
                + '<div class="wbm-tabs"><div class="wbm-tab active" data-t="0">📋 条目</div><div class="wbm-tab" data-t="1">⚙ 设置</div><div class="wbm-tab" data-t="2">📜 日志</div><div class="wbm-tab" data-t="3">🔬 调试</div></div>'
                + '<div class="wbm-body">'
                + '<div class="wbm-tp active" id="' + P + '-t0"><div class="wbm-row" style="margin-bottom:8px"><select id="' + P + '-booksel" style="flex:2"></select><button class="wbm-btn" id="' + P + '-refresh">↻</button><button class="wbm-btn wbm-btn-p" id="' + P + '-manual">▶ 手动审核</button></div><div id="' + P + '-entries"></div></div>'
                + '<div class="wbm-tp" id="' + P + '-t1"><div class="wbm-section">上下文模式</div><div class="wbm-fg"><label>条目上下文</label><select id="' + P + '-ctxMode"><option value="full">全量（含内容正文）</option><option value="summary">摘要（仅元数据）</option></select><p style="font-size:11px;color:#888;margin:4px 0">全量模式下AI可直接查看所有条目内容，无需二次调用。</p></div><div class="wbm-fg"><label>单条目内容截断（字符，0=不限）</label><input type="number" id="' + P + '-maxChars" min="0" value="0"></div><div class="wbm-fg"><label><input type="checkbox" id="' + P + '-dupGuard" checked> 追加重复防护</label><p style="font-size:11px;color:#888;margin:2px 0">防止 patch append 重复追加相同内容。</p></div><div class="wbm-section">调度</div><div class="wbm-row"><div class="wbm-fg"><label>起始楼层</label><input type="number" id="' + P + '-startAfter" min="0"></div><div class="wbm-fg"><label>间隔楼层</label><input type="number" id="' + P + '-interval" min="0"></div></div><div class="wbm-fg"><label>审核深度（消息数）</label><input type="number" id="' + P + '-reviewDepth" min="1" max="50"></div><div class="wbm-fg"><label><input type="checkbox" id="' + P + '-autoEnabled"> 自动审核</label></div><div class="wbm-section">API</div><div class="wbm-fg"><label>API来源</label><select id="' + P + '-apiSource"><option value="custom">自定义API</option><option value="tavern">酒馆主API</option></select></div><div class="wbm-row"><div class="wbm-fg"><label>端点</label><input type="text" id="' + P + '-endpoint" placeholder="https://..."></div><div class="wbm-fg"><label>模型</label><input type="text" id="' + P + '-model" placeholder="gpt-4o-mini"></div></div><div class="wbm-fg"><label>密钥</label><input type="text" id="' + P + '-key" placeholder="sk-..."></div><button class="wbm-btn" id="' + P + '-saveSettings">💾 保存设置</button></div>'
                + '<div class="wbm-tp" id="' + P + '-t2"><div id="' + P + '-log" style="font-size:11px;max-height:500px;overflow-y:auto"></div><button class="wbm-btn" id="' + P + '-clearLog" style="margin-top:8px">清空日志</button></div>'
                + '<div class="wbm-tp" id="' + P + '-t3"><div id="' + P + '-debug" style="font-size:11px"></div></div>'
                + '</div>'
                + '<div class="wbm-status" id="' + P + '-status">加载中…</div>';

            document.body.appendChild(panel);
            this._bindEvents();
            this._injected = true;
        },

        _bindEvents: function () {
            var self = this;

            // 关闭
            document.getElementById(P + '-close').addEventListener('click', function () { self.close(); });

            // 标签页
            document.querySelectorAll('#' + P + '-panel .wbm-tab').forEach(function (tab) {
                tab.addEventListener('click', function () {
                    var t = Number(tab.dataset.t);
                    document.querySelectorAll('#' + P + '-panel .wbm-tab').forEach(function (x) { x.classList.remove('active'); });
                    document.querySelectorAll('#' + P + '-panel .wbm-tp').forEach(function (x) { x.classList.remove('active'); });
                    tab.classList.add('active');
                    var tp = document.getElementById(P + '-t' + t);
                    if (tp) tp.classList.add('active');
                    RT.activeTab = t;
                    if (t === 2) self._renderLog();
                    if (t === 3) self._renderDebug();
                });
            });

            // 世界书选择
            document.getElementById(P + '-booksel').addEventListener('change', function () {
                RT.browsingBook = this.value;
                self._renderEntries();
            });

            // 刷新
            document.getElementById(P + '-refresh').addEventListener('click', function () { self.refresh(); });

            // 手动审核
            document.getElementById(P + '-manual').addEventListener('click', function () { Sched.manual(); });

            // 保存设置
            document.getElementById(P + '-saveSettings').addEventListener('click', function () {
                RT.cfg.contextMode = document.getElementById(P + '-ctxMode').value;
                RT.cfg.maxContentChars = Number(document.getElementById(P + '-maxChars').value) || 0;
                RT.cfg.patchDuplicateGuard = document.getElementById(P + '-dupGuard').checked;
                RT.cfg.startAfter = Number(document.getElementById(P + '-startAfter').value) || 0;
                RT.cfg.interval = Number(document.getElementById(P + '-interval').value) || 0;
                RT.cfg.reviewDepth = Number(document.getElementById(P + '-reviewDepth').value) || 10;
                RT.cfg.autoEnabled = document.getElementById(P + '-autoEnabled').checked;
                RT.cfg.apiSource = document.getElementById(P + '-apiSource').value;
                RT.api.endpoint = document.getElementById(P + '-endpoint').value;
                RT.api.model = document.getElementById(P + '-model').value;
                RT.api.key = document.getElementById(P + '-key').value;
                Store.saveConfig(RT.cfg);
                Store.saveApi(RT.api);
                Toast.show('设置已保存', 'success');
            });

            // 清空日志
            document.getElementById(P + '-clearLog').addEventListener('click', function () { Store.saveLog([]); self._renderLog(); });
        },

        _loadSettingsToUI: function () {
            var el = function (id) { return document.getElementById(P + '-' + id); };
            if (el('ctxMode')) el('ctxMode').value = RT.cfg.contextMode || 'full';
            if (el('maxChars')) el('maxChars').value = RT.cfg.maxContentChars || 0;
            if (el('dupGuard')) el('dupGuard').checked = RT.cfg.patchDuplicateGuard !== false;
            if (el('startAfter')) el('startAfter').value = RT.cfg.startAfter;
            if (el('interval')) el('interval').value = RT.cfg.interval;
            if (el('reviewDepth')) el('reviewDepth').value = RT.cfg.reviewDepth;
            if (el('autoEnabled')) el('autoEnabled').checked = RT.cfg.autoEnabled;
            if (el('apiSource')) el('apiSource').value = RT.cfg.apiSource;
            if (el('endpoint')) el('endpoint').value = RT.api.endpoint;
            if (el('model')) el('model').value = RT.api.model;
            if (el('key')) el('key').value = RT.api.key;
        },

        _populateBookSelect: function () {
            var sel = document.getElementById(P + '-booksel');
            if (!sel) return;
            var books = Book.getAvailableBooks();
            sel.innerHTML = '<option value="">-- 选择世界书 --</option>';
            books.forEach(function (b) {
                var opt = document.createElement('option');
                opt.value = b.name; opt.textContent = b.name + ' (' + b.type + ')';
                sel.appendChild(opt);
            });
            if (RT.browsingBook) sel.value = RT.browsingBook;
        },

        _renderEntries: async function () {
            var container = document.getElementById(P + '-entries');
            if (!container) return;

            this._populateBookSelect();
            this._loadSettingsToUI();

            var bk = RT.browsingBook;
            if (!bk) {
                // 尝试自动选择目标世界书
                bk = await Book.getTargetBookName();
                if (bk) { RT.browsingBook = bk; var sel = document.getElementById(P + '-booksel'); if (sel) sel.value = bk; }
            }
            if (!bk) { container.innerHTML = '<div style="text-align:center;padding:24px;color:#888"><i class="fa-solid fa-book-open" style="font-size:32px;opacity:.3;display:block;margin-bottom:12px"></i>请选择世界书</div>'; return; }

            var entries = await Book.getEntries(bk);
            var vis = entries.filter(function (e) { return e.comment !== FMT_COMMENT; });
            vis = _sort(vis);

            if (vis.length === 0) { container.innerHTML = '<div style="text-align:center;padding:24px;color:#888">世界书为空</div>'; return; }

            var html = '';
            vis.forEach(function (e) {
                var dis = _isOn(e) ? '' : ' dis';
                var con = _isCon(e) ? ' con' : '';
                var keys = _getKeys(e);
                var preview = (e.content || '').substring(0, 80).replace(/\n/g, ' ');
                var dep = _dep(e); dep = dep != null ? dep : '?';
                var mode = _isCon(e) ? '🔵' : '🟢';
                var uid = Book.uid(e) || '?';

                var badges = '<span class="wbm-badge">' + mode + ' d:' + dep + ' o:' + _ord(e) + '</span>';
                if (e.sticky != null) badges += '<span class="wbm-badge">📌' + e.sticky + '</span>';
                if (e.cooldown != null) badges += '<span class="wbm-badge">❄' + e.cooldown + '</span>';
                if (e.prevent_recursion || e.excludeRecursion) badges += '<span class="wbm-badge">🚫递归</span>';
                if (e.vectorized) badges += '<span class="wbm-badge">📐向量</span>';

                html += '<div class="wbm-entry' + dis + con + '" data-uid="' + uid + '">'
                    + '<div class="wbm-en">' + _esc(_dn(e)) + ' <span style="font-weight:normal;font-size:11px;color:#888">#' + uid + '</span></div>'
                    + (keys ? '<div class="wbm-ek">🔑 ' + _esc(keys) + '</div>' : '')
                    + (preview ? '<div class="wbm-ep">' + _esc(preview) + '</div>' : '')
                    + '<div class="wbm-badges">' + badges + '</div>'
                    + '</div>';
            });

            container.innerHTML = html;
        },

        _renderLog: function () {
            var container = document.getElementById(P + '-log');
            if (!container) return;
            var logs = Store.loadLog().slice(-50).reverse();
            if (logs.length === 0) { container.innerHTML = '<div style="color:#888;text-align:center;padding:20px">暂无日志</div>'; return; }
            var html = '';
            logs.forEach(function (l) {
                var time = l.ts ? new Date(l.ts).toLocaleTimeString() : '?';
                var icon = l.status === 'ok' ? '✅' : (l.status === 'error' ? '❌' : '⏭');
                html += '<div style="padding:4px 0;border-bottom:1px solid #222">'
                    + '<span style="color:#888">' + time + '</span> '
                    + icon + ' <b>' + _esc(l.action || '') + '</b> '
                    + _esc(l.name || '') + ' '
                    + '<span style="color:#888">' + _esc(l.detail || l.reason || '') + '</span>'
                    + '</div>';
            });
            container.innerHTML = html;
        },

        _renderDebug: function () {
            var container = document.getElementById(P + '-debug');
            if (!container) return;
            if (!RT.lastDebug) { container.innerHTML = '<div style="color:#888">暂无调试数据</div>'; return; }
            var d = RT.lastDebug;
            var html = '<b>最近一次审核</b> (楼:' + d.floor + ' 模式:' + d.mode + ')<br>';
            html += '<br><b>解析到 ' + (d.parsed ? d.parsed.length : 0) + ' 条指令</b>';
            if (d.parsed && d.parsed.length > 0) {
                d.parsed.forEach(function (cmd, i) {
                    html += '<br>' + (i+1) + '. ' + cmd.action + ' 「' + _esc(cmd.entry_name) + '」';
                    if (cmd.ops && cmd.ops.length > 0) html += ' (' + cmd.ops.length + ' ops)';
                });
            }
            html += '<br><br><b>AI原始回复（前500字）：</b><br><pre style="white-space:pre-wrap;max-height:200px;overflow-y:auto;background:rgba(0,0,0,.2);padding:8px;border-radius:4px;font-size:11px">' + _esc((d.received || '').substring(0, 500)) + '</pre>';
            container.innerHTML = html;
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §16  CSS                                             ║
    // ╚═══════════════════════════════════════════════════════╝

    function injectCSS() {
        if (document.getElementById(P + '-css')) return;
        $('<style>').attr('id', P + '-css').text(
            '@keyframes '+P+'TI{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}'+  
            '@keyframes '+P+'P{0%,100%{box-shadow:0 4px 16px rgba(154,99,213,.5)}50%{box-shadow:0 4px 24px rgba(254,225,161,.7)}}'+  
            '@keyframes '+P+'FI{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}'+  
            '#'+P+'-fab{position:fixed;bottom:85px;right:30px;z-index:9999;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,rgba(154,99,213,.7),rgba(90,57,150,.7));border:1px solid #FEE1A1;color:#fff;font-size:18px;cursor:pointer;box-shadow:0 4px 12px rgba(154,99,213,.4);display:flex;align-items:center;justify-content:center;transition:all .3s;background-image:url("https://pic.itxiaohui.top/20260222/28ef1779c4cc77c0a36ac29f3839b664.png");background-size:95%;background-position:center;background-repeat:no-repeat}'+  
            '#'+P+'-fab:hover{transform:scale(1.12);box-shadow:0 6px 16px rgba(154,99,213,.6)}'+  
            '#'+P+'-fab:active{transform:scale(.95)}'+  
            '#'+P+'-fab.proc{animation:'+P+'P 1.2s infinite}'+  
            '#'+P+'-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;justify-content:center;align-items:center;backdrop-filter:blur(2px)}'+  
            '#'+P+'-ov.open{display:flex}'+  
            '#'+P+'-pn{background:#402B71;border:1px solid #FFF6AE;border-radius:12px;width:620px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,.6);color:#ECCDEE;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;overflow:hidden;animation:'+P+'FI .25s ease}'+  
            '.'+P+'-tb{display:flex;align-items:center;padding:12px 16px;background:#5A3996;border-bottom:1px solid #FFF6AE;flex-shrink:0}'+  
            '.'+P+'-tb h3{margin:0;flex:1;font-size:15px;font-weight:600;color:#ECCDEE}'+  
            '.'+P+'-xb{background:none;border:none;color:#ECCDEE;font-size:24px;cursor:pointer;padding:0 4px;line-height:1;transition:color .2s}'+  
            '.'+P+'-xb:hover{color:#f44336}'+  
            '.'+P+'-tabs{display:flex;background:#5A3996;border-bottom:1px solid #FFF6AE;flex-shrink:0;overflow-x:auto}'+  
            '.'+P+'-tab{flex:1;min-width:0;padding:9px 4px;text-align:center;cursor:pointer;font-size:11px;color:#ECCDEE;border-bottom:2px solid transparent;white-space:nowrap;user-select:none;transition:all .2s}'+  
            '.'+P+'-tab:hover{background:rgba(154,99,213,.05)}'+  
            '.'+P+'-tab.act{color:#9A63D5;border-bottom-color:#9A63D5;background:rgba(154,99,213,.08)}'+  
            '.'+P+'-bd{flex:1;overflow-y:auto;padding:14px 16px;scrollbar-width:thin;scrollbar-color:#9A63D5 #402B71}'+  
            '.'+P+'-bd::-webkit-scrollbar{width:6px}'+  
            '.'+P+'-bd::-webkit-scrollbar-track{background:#402B71}'+  
            '.'+P+'-bd::-webkit-scrollbar-thumb{background:#9A63D5;border-radius:3px}'+  
            '.'+P+'-bd::-webkit-scrollbar-thumb:hover{background:#ECCDEE}'+  
            '.'+P+'-sb{display:flex;align-items:center;padding:8px 16px;background:#5A3996;border-top:1px solid #FFF6AE;font-size:11px;color:#ECCDEE;flex-shrink:0;gap:6px;white-space:nowrap;overflow-x:auto}'+  
            '.'+P+'-inp{width:100%;box-sizing:border-box;padding:7px 10px;background:#402B71;border:1px solid #FEE1A1;border-radius:6px;color:#ECCDEE;font-size:13px;outline:none;transition:all .2s}'+  
            '.'+P+'-inp:focus{border-color:#9A63D5;box-shadow:0 0 0 2px rgba(154,99,213,.2)}'+  
            '.'+P+'-ta{width:100%;box-sizing:border-box;padding:7px 10px;background:#402B71;border:1px solid #FEE1A1;border-radius:6px;color:#ECCDEE;font-size:13px;outline:none;resize:vertical;min-height:60px;font-family:inherit;transition:all .2s}'+  
            '.'+P+'-ta:focus{border-color:#9A63D5;box-shadow:0 0 0 2px rgba(154,99,213,.2)}'+  
            '.'+P+'-sel{width:100%;box-sizing:border-box;padding:7px 10px;background:#402B71;border:1px solid #FEE1A1;border-radius:6px;color:#ECCDEE;font-size:13px;outline:none;transition:all .2s}'+  
            '.'+P+'-sel:focus{border-color:#9A63D5;box-shadow:0 0 0 2px rgba(154,99,213,.2)}'+  
            '.'+P+'-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:12px;color:#fff;white-space:nowrap;transition:all .2s;font-weight:500}'+  
            '.'+P+'-btn:hover{opacity:.85;transform:translateY(-1px)}'+  
            '.'+P+'-btn:active{transform:translateY(0)}'+  
            '.'+P+'-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}'+  
            '.'+P+'-bp{background:linear-gradient(135deg,#9A63D5,#5A3996)}'+  
            '.'+P+'-bs{background:linear-gradient(135deg,#4caf50,#43a047)}'+  
            '.'+P+'-bw{background:linear-gradient(135deg,#ff9800,#f57c00);color:#1a1a1a}'+  
            '.'+P+'-bd2{background:linear-gradient(135deg,#f44336,#e53935)}'+  
            '.'+P+'-bg{background:#402B71;color:#ECCDEE;border:1px solid #FEE1A1}'+  
            '.'+P+'-bg:hover{background:#5A3996}'+  
            '.'+P+'-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}'+  
            '.'+P+'-lbl{font-size:12px;color:#ECCDEE;margin-bottom:4px;line-height:1.5}'+  
            '.'+P+'-grp{margin-bottom:12px}'+  
            '.'+P+'-card{background:#5A3996;border:1px solid #FEE1A1;border-radius:8px;padding:12px;margin-bottom:10px;transition:all .2s}'+  
            '.'+P+'-card:hover{box-shadow:0 2px 8px rgba(154,99,213,.2)}'+  
            '.'+P+'-empty{padding:30px;text-align:center;color:#ECCDEE;font-size:13px;white-space:pre-wrap}'+  
            '.'+P+'-ei{display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(254,225,161,.5);gap:8px;transition:all .15s}'+  
            '.'+P+'-ei:hover{background:rgba(154,99,213,.04);transform:translateX(2px)}'+  
            '.'+P+'-ei:last-child{border-bottom:none}'+  
            '.'+P+'-ei.dis{opacity:.45}'+  
            '.'+P+'-en{flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}'+  
            '.'+P+'-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;white-space:nowrap;font-weight:500;transition:all .2s}'+  
            '.'+P+'-tbl{background:rgba(64,43,113,.8);color:#9A63D5}'+  
            '.'+P+'-tgr{background:rgba(90,57,150,.8);color:#ECCDEE}'+  
            '.'+P+'-tgy{background:rgba(154,99,213,.8);color:#ECCDEE}'+  
            '.'+P+'-trd{background:rgba(244,67,54,.8);color:#f44336}'+  
            '.'+P+'-coll{border:1px solid #FEE1A1;border-radius:8px;margin-bottom:10px;overflow:hidden;transition:all .2s}'+  
            '.'+P+'-ch{display:flex;align-items:center;padding:10px 14px;background:#5A3996;cursor:pointer;user-select:none;gap:8px;font-size:13px;font-weight:500;transition:all .2s}'+  
            '.'+P+'-ch:hover{background:#9A63D5;color:#ECCDEE}'+  
            '.'+P+'-cb{padding:12px 14px;display:none;background:#402B71}'+  
            '.'+P+'-coll.open .'+P+'-cb{display:block}'+  
            '.'+P+'-ca{transition:transform .2s;font-size:10px;color:#9A63D5}'+  
            '.'+P+'-coll.open .'+P+'-ca{transform:rotate(90deg)}'+  
            '.'+P+'-sw{position:relative;width:40px;height:22px;cursor:pointer;display:inline-block;vertical-align:middle}'+  
            '.'+P+'-sw input{display:none}'+  
            '.'+P+'-sw .sl{position:absolute;inset:0;background:#402B71;border:1px solid #FEE1A1;border-radius:11px;transition:.3s}'+  
            '.'+P+'-sw .sl::before{content:"";position:absolute;width:16px;height:16px;left:3px;bottom:3px;background:#ECCDEE;border-radius:50%;transition:.3s}'+  
            '.'+P+'-sw input:checked+.sl{background:#9A63D5}'+  
            '.'+P+'-sw input:checked+.sl::before{transform:translateX(18px)}'+  
            '.'+P+'-rg{display:flex;gap:12px;flex-wrap:wrap;margin:6px 0}'+  
            '.'+P+'-rg label{display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;padding:4px 8px;border-radius:4px;transition:all .2s}'+  
            '.'+P+'-rg label:hover{background:rgba(154,99,213,.08);transform:translateY(-1px)}'+  
            '.'+P+'-dbg{background:#402B71;border:1px solid #FEE1A1;border-radius:6px;padding:10px 12px;margin:6px 0;font-family:Consolas,Monaco,monospace;font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-all;max-height:500px;overflow-y:auto;color:#ECCDEE}'+  
            '.'+P+'-li{padding:8px 0;border-bottom:1px solid rgba(254,225,161,.4);font-size:12px;line-height:1.5;transition:all .15s}'+  
            '.'+P+'-li:hover{padding-left:4px}'+  
            '.'+P+'-li:last-child{border-bottom:none}'+  
            '.'+P+'-lok{color:#4caf50;font-weight:500}'+  
            '.'+P+'-ler{color:#f44336;font-weight:500}'+  
            '.'+P+'-lsk{color:#ff9800;font-weight:500}'+  
            '.'+P+'-info{background:rgba(154,99,213,.06);border:1px solid rgba(154,99,213,.2);border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:12px;color:#ECCDEE;line-height:1.6}'+  
            '.'+P+'-info b{color:#9A63D5}'+  
            '.'+P+'-warn{background:rgba(255,152,0,.06);border:1px solid rgba(255,152,0,.2);border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:12px;color:#cc9a3c}'+  
            '.'+P+'-err-box{background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.2);border-radius:8px;padding:14px;text-align:center;color:#ef9a9a}'+  
            '.'+P+'-edet{background:#402B71;border-top:1px solid #FEE1A1;padding:10px 12px;font-size:11px;color:#ECCDEE;line-height:1.6;display:none;transition:all .2s}'+  
            '.'+P+'-edet.open{display:block;animation:fadeIn .3s ease}'+  
            '.'+P+'-edet .'+P+'-dbg{max-height:500px}'+  
            '.'+P+'-edet-field{margin-bottom:4px}'+  
            '.'+P+'-edet-field b{color:#ECCDEE;font-weight:500}'+  
            '.'+P+'-dep-ok{color:#4caf50}'+  
            '.'+P+'-dep-no{color:#f44336}'+  
            '.'+P+'-bsel{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}'+  
            '.'+P+'-bsel-item{padding:5px 10px;border:1px solid #FEE1A1;border-radius:6px;cursor:pointer;font-size:11px;background:#402B71;color:#ECCDEE;transition:all .2s}'+  
            '.'+P+'-bsel-item:hover{border-color:#9A63D5;transform:translateY(-1px)}'+  
            '.'+P+'-bsel-item.act{background:rgba(154,99,213,.15);border-color:#9A63D5;color:#9A63D5;font-weight:600}'+  
            '.'+P+'-chat-sys{background:#402B71;border-left:3px solid #9A63D5;padding:8px 12px;margin:6px 0;border-radius:0 6px 6px 0;font-size:12px;color:#ECCDEE;white-space:pre-wrap;word-break:break-word}'+  
            '.'+P+'-chat-usr{background:#5A3996;border-left:3px solid #4caf50;padding:8px 12px;margin:6px 0;border-radius:0 6px 6px 0;font-size:12px;color:#ECCDEE;white-space:pre-wrap;word-break:break-word}'+  
            '.'+P+'-chat-ast{background:#9A63D5;border-left:3px solid #FEE1A1;padding:8px 12px;margin:6px 0;border-radius:0 6px 6px 0;font-size:12px;color:#402B71;white-space:pre-wrap;word-break:break-word}'+  
            '.'+P+'-chat-role{font-weight:600;font-size:10px;text-transform:uppercase;margin-bottom:2px;opacity:.7}'+  
            '.'+P+'-pe{background:#5A3996;border:1px solid #FEE1A1;border-radius:8px;padding:10px 12px;margin-bottom:6px;transition:all .2s}'+  
            '.'+P+'-pe:hover{box-shadow:0 2px 6px rgba(154,99,213,.2)}'+  
            '.'+P+'-pe.dis{opacity:.45}'+  
            '.'+P+'-pe-head{display:flex;align-items:center;gap:8px;cursor:pointer}'+  
            '.'+P+'-pe-body{display:none;margin-top:8px;padding-top:8px;border-top:1px solid #FEE1A1}'+  
            '.'+P+'-pe.open .'+P+'-pe-body{display:block;animation:fadeIn .3s ease}'+  
            '@media(max-width:480px){#'+P+'-fab{width:36px;height:36px;bottom:14px;right:14px;font-size:16px}#'+P+'-pn{width:100vw;max-width:100vw;max-height:100vh;height:100vh;border-radius:0;border:none}.'+P+'-tab{font-size:10px}.'+P+'-btn{padding:8px 14px;font-size:13px}}'+ 
            '@media(min-width:1024px){#'+P+'-pn{width:850px;max-width:80vw;max-height:90vh}.'+P+'-tb{justify-content:space-between}.'+P+'-tabs{order:1;flex-direction:row-reverse}.'+P+'-tab{font-size:12px;padding:10px 6px}.'+P+'-bd{padding:16px 20px}.'+P+'-btn{padding:7px 14px;font-size:13px}.'+P+'-row{gap:10px}.'+P+'-lbl{font-size:13px}.'+P+'-card{padding:14px}.'+P+'-ei{padding:12px 14px}.'+P+'-en{font-size:14px}}'+ 
            '@media(min-width:768px) and (max-width:1023px){#'+P+'-pn{width:700px;max-width:90vw;max-height:88vh}.'+P+'-tab{font-size:11px;padding:9px 5px}.'+P+'-bd{padding:15px 18px}.'+P+'-btn{padding:6px 12px;font-size:12px}.'+P+'-row{gap:9px}.'+P+'-lbl{font-size:12px}.'+P+'-card{padding:13px}.'+P+'-ei{padding:11px 13px}}'+  
            '@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'
        ).appendTo('head');
    }

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §17  UI (7 tabs) — 完整保留所有功能                    ║
    // ╚═══════════════════════════════════════════════════════╝

    var TABS = [{i:'📚',l:'世界书'},{i:'✏️',l:'提示词'},{i:'🔌',l:'API'},{i:'⚙️',l:'设置'},{i:'💬',l:'后台'},{i:'🔍',l:'调试'},{i:'📜',l:'日志'}];

    var UI = {
        fab:null,ov:null,pn:null,bd:null,sb:null,
        el:function(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;},
        btn:function(label,cls,fn){var b=this.el('button',P+'-btn '+(cls||P+'-bg'),label);if(fn)b.onclick=function(ev){ev.stopPropagation();try{fn();}catch(e){_err('btn',e);}};return b;},
        inp:function(val,ph){var i=this.el('input',P+'-inp');i.value=val||'';if(ph)i.placeholder=ph;return i;},
        ta:function(val,h){var t=this.el('textarea',P+'-ta');t.value=val||'';if(h)t.style.minHeight=h;return t;},
        chk:function(checked){var c=document.createElement('input');c.type='checkbox';c.checked=!!checked;return c;},
        radio:function(name,checked){var r=document.createElement('input');r.type='radio';r.name=name;r.checked=!!checked;return r;},
        coll:function(title,open,builder){var w=this.el('div',P+'-coll'+(open?' open':''));var h=this.el('div',P+'-ch');h.innerHTML='<span class="'+P+'-ca">▶</span> <span style="flex:1">'+_esc(title)+'</span>';var b=this.el('div',P+'-cb');var built=false;h.onclick=function(){var isO=w.classList.toggle('open');if(isO&&!built){built=true;try{var c=builder();if(c instanceof HTMLElement)b.appendChild(c);}catch(e){b.textContent='Error: '+e.message;}}};w.appendChild(h);w.appendChild(b);if(open){built=true;try{var c=builder();if(c instanceof HTMLElement)b.appendChild(c);}catch(e){b.textContent='Error: '+e.message;}}return w;},
        build:function(){try{var $ov=$('<div id="'+P+'-ov"></div>');$ov.appendTo('body');this.ov=$ov[0];this.pn=this.el('div');this.pn.id=P+'-pn';var tb=this.el('div',P+'-tb');tb.appendChild(this.el('h3','','📖 世界书动态管理'));var xb=this.el('button',P+'-xb','×');tb.appendChild(xb);this.pn.appendChild(tb);var tabs=this.el('div',P+'-tabs');var self=this;TABS.forEach(function(t,i){var tab=self.el('div',P+'-tab'+(i===0?' act':''));tab.innerHTML=t.i+'<br>'+t.l;tab.onclick=function(){self.switchTab(i);};tabs.appendChild(tab);});this.pn.appendChild(tabs);this.bd=this.el('div',P+'-bd');this.pn.appendChild(this.bd);this.sb=this.el('div',P+'-sb','就绪');this.pn.appendChild(this.sb);this.ov.appendChild(this.pn);
        
        // 根据配置决定是否创建悬浮窗
        if(RT.cfg.fabEnabled!==false){var $fab=$('<button id="'+P+'-fab" title="WBM"></button>');$fab.appendTo('body');this.fab=$fab[0];
        // 添加拖动功能
        this._initDrag();
        
        $fab.on('click',function(){self.toggle();});}else{
            this.fab=null;
        }
        
        // 确保面板关闭功能正常工作
        $(xb).on('click',function(){self.toggle();});
        $ov.on('click',function(ev){if(ev.target===self.ov)self.toggle();});
        $(document).on('keydown',function(ev){if(ev.key==='Escape'&&RT.panelOpen)self.toggle();});
        
        this.switchTab(0);}catch(e){_err('UI.build',e);}},
        toggle:function(){RT.panelOpen=!RT.panelOpen;if(this.ov)$(this.ov).toggleClass('open',RT.panelOpen);if(RT.panelOpen)this.refresh();},
        switchTab:function(idx){RT.activeTab=idx;if(this.pn)$(this.pn).find('.'+P+'-tab').removeClass('act').eq(idx).addClass('act');this.refresh();},
        refresh:function(){if(!this.bd)return;this.bd.innerHTML='';var c=this.bd;try{switch(RT.activeTab){case 0:this._safeAsync(c,this._tEntries.bind(this,c));break;case 1:this._tPrompts(c);break;case 2:this._tAPI(c);break;case 3:this._tSettings(c);break;case 4:this._tBackend(c);break;case 5:this._tDebug(c);break;case 6:this._tLog(c);break;}}catch(e){c.textContent='Error: '+e.message;}this.status();},
        _safeAsync:function(c,fn){try{var p=fn();if(p&&typeof p.catch==='function')p.catch(function(e){c.innerHTML='';c.appendChild(UI.el('div',P+'-err-box','错误: '+e.message));});}catch(e){c.textContent='Error: '+e.message;}},
        status:function(msg){if(this.fab)$(this.fab).toggleClass('proc',RT.processing);if(!this.sb)return;if(msg){this.sb.textContent=msg;return;}var af=_aiFloor();var tl={charPrimary:'👤主书',charAdditional:'📎附加',global:'🌍全局',managed:'📝托管'};var rs='';if(!RT.depsL0)rs=' | ❌依赖';else if(!RT.depsL2)rs=' | ⚠️只读(等待TavernHelper)';else rs=' | ✅读写';var autoStatus=RT.cfg.autoEnabled?(RT.depsL2?'🟢自动':'🟡自动(只读)'):'🔴关闭';var fabStatus=RT.cfg.fabEnabled?'🟢悬浮窗':'🔴无悬浮窗';var pendingCount=PendingQueue.count();var pendingStatus=pendingCount>0?' | 📋'+pendingCount+'待审':'';this.sb.textContent='楼:'+af+' | 上次:'+(RT.lastAiFloor||'-')+' | 下次:'+(RT.nextUpdateAiFloor||'-')+' | '+(RT.cfg.mode==='inline'?'主API':'外部('+RT.cfg.apiSource+')')+' | '+(tl[RT.cfg.targetType]||'?')+' | '+autoStatus+rs+' | '+fabStatus+pendingStatus;},

        // Tab 0: 世界书
        _tEntries:async function(c){var self=this,w=this.el('div');var dc=this.el('div',P+'-info');dc.style.padding='8px 14px';dc.innerHTML='依赖: <span class="'+P+(RT.depsL0?'-dep-ok':'-dep-no')+'">L0'+(RT.depsL0?'✓':'✗')+'</span> <span class="'+P+(RT.depsL1?'-dep-ok':'-dep-no')+'">L1'+(RT.depsL1?'✓':'✗')+'</span> <span class="'+P+(RT.depsL2?'-dep-ok':'-dep-no')+'">L2'+(RT.depsL2?'✓':'✗')+'</span>';w.appendChild(dc);
        if(!RT.depsL0){w.appendChild(this.el('div',P+'-err-box','⚠️ 依赖未就绪'));c.appendChild(w);return;}
        var books=Book.getAvailableBooks();if(books.length===0){w.appendChild(this.el('div',P+'-warn','未检测到世界书'));c.appendChild(w);return;}
        w.appendChild(this.el('div',P+'-lbl','选择世界书:'));var bsel=this.el('div',P+'-bsel');var typeIc={global:'🌍',charPrimary:'👤',charAdditional:'📎',chat:'💬'};var cb=RT.browsingBook,vb=books.map(function(b){return b.name;});if(!cb||vb.indexOf(cb)===-1){try{var tb2=await Book.getTargetBookName();cb=(tb2&&vb.indexOf(tb2)!==-1)?tb2:books[0].name;}catch(e){cb=books[0].name;}RT.browsingBook=cb;}
        books.forEach(function(bk){var it=self.el('div',P+'-bsel-item'+(bk.name===cb?' act':''));it.textContent=(typeIc[bk.type]||'📁')+' '+bk.name;it.onclick=function(){RT.browsingBook=bk.name;self.refresh();};bsel.appendChild(it);});w.appendChild(bsel);
        var bk=cb;var hr=this.el('div',P+'-row');hr.appendChild(this.btn('🔄 刷新',P+'-bg',function(){self.refresh();}));var ab=this.btn('➕ 新增',P+'-bp',function(){self._entryEditor(w,bk,null);});if(!RT.depsL2)ab.disabled=true;hr.appendChild(ab);hr.appendChild(this.btn('🤖 审核',P+'-bw',function(){Sched.manual();}));hr.appendChild(this.btn('📋 队列',P+'-bg',function(){self._showPendingQueue(w);}));hr.appendChild(this.btn('🔄 注入',P+'-bp',function(){self._injectWorldbook(bk);}));
        hr.appendChild(this.btn('🔬 诊断',P+'-bg',async function(){RT._diagDone=false;RT._diagData=null;var entries=await Book.getEntries(bk);if(entries.length===0){alert('无条目');return;}var s=entries[0];var keys=Object.keys(s);var conC=0;entries.forEach(function(e){if(_isCon(e))conC++;});var info='total='+entries.length+' 蓝灯='+conC+'\nfields: '+keys.join(', ')+'\nsample.constant='+JSON.stringify(s.constant)+' ('+typeof s.constant+')\nsample.selective='+JSON.stringify(s.selective)+'\nsample.keys='+JSON.stringify(s.keys)+'\nsample.key='+JSON.stringify(s.key)+'\n\n完整:\n'+JSON.stringify(s,null,2);console.log('[WBM诊断]',info);var ta2=self.el('textarea',P+'-ta');ta2.value=info;ta2.style.minHeight='200px';var d=self.el('div',P+'-card');d.appendChild(self.el('div',P+'-lbl','诊断结果'));d.appendChild(ta2);w.insertBefore(d,w.children[2]||null);}));
        w.appendChild(hr);if(!RT.depsL1){w.appendChild(this.el('div',P+'-warn','⚠️ 读取不可用'));c.appendChild(w);return;}
        var sr=this.el('div',P+'-row');var si=this.inp('','🔍 搜索...');si.style.flex='1';sr.appendChild(si);w.appendChild(sr);
        var all=await Book.getEntries(bk);var vis=all.filter(function(e){return e.comment!==FMT_COMMENT;});vis=_sort(vis);var conC=vis.filter(function(e){return _isCon(e);}).length;var enC=vis.filter(function(e){return _isOn(e);}).length;var disC=vis.length-enC;
        var sRow=this.el('div',P+'-row');sRow.style.cssText='margin-bottom:6px;gap:12px';sRow.appendChild(this.el('span',P+'-tag '+P+'-tgy','共 '+vis.length));sRow.appendChild(this.el('span',P+'-tag '+P+'-tbl','🔵永久 '+conC));sRow.appendChild(this.el('span',P+'-tag '+P+'-tgr','🟢关键词 '+(vis.length-conC)));if(disC>0)sRow.appendChild(this.el('span',P+'-tag '+P+'-trd','⏸禁用 '+disC));w.appendChild(sRow);
        var lw=this.el('div',P+'-card');lw.style.cssText='max-height:400px;overflow-y:auto;padding:0';
        var renderList=function(filter){lw.innerHTML='';var items=filter?Search.find(vis,filter).map(function(r){return r.entry;}):vis;if(!items.length){lw.appendChild(self.el('div',P+'-empty',filter?'未找到':'空'));return;}
        items.forEach(function(e){var uid=Book.uid(e),en=_isOn(e),isCon=_isCon(e),dn=_dn(e);var depV=_dep(e),depS=depV!=null?String(depV):'?';var ek=_getKeys(e);var wrapper=self.el('div');var row=self.el('div',P+'-ei'+(en?'':' dis'));var ck=self.chk(en);if(!RT.depsL2)ck.disabled=true;ck.onchange=async function(){if(!uid){ck.checked=!ck.checked;return;}try{await Book.setField(bk,uid,'enabled',ck.checked);}catch(err){alert(err.message);ck.checked=!ck.checked;}};row.appendChild(ck);var ne=self.el('span',P+'-en',dn);ne.style.cursor='pointer';row.appendChild(ne);row.appendChild(self.el('span',P+'-tag '+P+'-tgy','d:'+depS));row.appendChild(self.el('span',P+'-tag '+P+'-tgy','o:'+_ord(e)));row.appendChild(self.el('span',P+'-tag '+(isCon?P+'-tbl':P+'-tgr'),isCon?'🔵永久':'🟢关键词'));var eb=self.btn('✏️',P+'-bg',function(){self._entryEditor(w,bk,e);});if(!RT.depsL2)eb.disabled=true;row.appendChild(eb);var db=self.btn('🗑',P+'-bd2',async function(){if(!uid)return;if(RT.cfg.confirmDelete&&!confirm('删除「'+dn+'」？'))return;try{await Book.deleteEntry(bk,uid);self.refresh();}catch(err){alert(err.message);}});if(!RT.depsL2)db.disabled=true;row.appendChild(db);wrapper.appendChild(row);
        var det=self.el('div',P+'-edet');det.innerHTML='<div class="'+P+'-edet-field"><b>关键词:</b> '+_esc(ek||'无')+'</div><div class="'+P+'-edet-field"><b>深度:</b> '+depS+' | <b>排序:</b> '+_ord(e)+' | <b>模式:</b> '+(isCon?'🔵永久':'🟢关键词')+' | <b>状态:</b> '+(en?'✅':'⏸')+' | <b>constant:</b> '+JSON.stringify(e.constant)+' | <b>selective:</b> '+JSON.stringify(e.selective)+'</div>'+(e.comment?'<div class="'+P+'-edet-field"><b>备忘:</b> '+_esc(e.comment)+'</div>':'')+'<div class="'+P+'-edet-field"><b>内容:</b></div><div class="'+P+'-dbg">'+_esc(e.content||'(空)')+'</div>';
        ne.onclick=function(){det.classList.toggle('open');};wrapper.appendChild(det);lw.appendChild(wrapper);});};si.oninput=function(){renderList(si.value.trim());};renderList('');w.appendChild(lw);c.appendChild(w);},

        _showPendingQueue:function(pw){var self=this,queue=PendingQueue.getPending();var old=pw.querySelector('.'+P+'-pq');if(old)old.remove();var m=this.el('div',P+'-card '+P+'-pq');m.style.borderColor='#9A63D5';m.appendChild(this.el('div','','📋 审核队列 ('+queue.length+'条)')).style.cssText='font-weight:600;color:#9A63D5;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #FEE1A1';if(!queue.length){m.appendChild(this.el('div',P+'-empty','空'));pw.insertBefore(m,pw.children[1]||null);return;}var list=this.el('div');queue.forEach(function(item){var itm=self.el('div',P+'-pe');var head=self.el('div',P+'-pe-head');head.appendChild(self.el('span',P+'-en','第'+item.floor+'楼 | '+item.commands.length+'条'));head.appendChild(self.btn('✅',P+'-bs',async function(){await PendingQueue.approve(item.id);self.refresh();}));head.appendChild(self.btn('❌',P+'-bd2',function(){PendingQueue.reject(item.id);self.refresh();}));itm.appendChild(head);var body=self.el('div',P+'-pe-body');body.appendChild(self.el('div',P+'-lbl','指令：'));item.commands.forEach(function(cmd){body.appendChild(self.el('div',P+'-dbg',cmd.action+' 「'+cmd.entry_name+'」'));});itm.appendChild(body);list.appendChild(itm);});m.appendChild(list);var br=this.el('div',P+'-row');br.style.cssText='justify-content:flex-end;gap:10px;margin-top:12px';br.appendChild(this.btn('✅ 全部批准',P+'-bs',async function(){await PendingQueue.approveAll();self.refresh();}));br.appendChild(this.btn('❌ 全部拒绝',P+'-bd2',function(){PendingQueue.rejectAll();self.refresh();}));m.appendChild(br);pw.insertBefore(m,pw.children[1]||null);},

        _injectWorldbook:async function(bk){var self=this;try{var toast=Toast.persistent('🔄 正在注入世界书...','info');var queue=PendingQueue.getPending();if(queue.length>0){toast.update('🔄 正在处理审核队列...','info');await PendingQueue.approveAll();}toast.update('✅ 注入完成','success');toast.close(2000);self.refresh();}catch(e){_err('注入失败',e);Toast.show('❌ 注入失败: '+e.message,'error');}},

        _entryEditor:function(pw,bk,entry){if(!RT.depsL2){alert('写入不可用');return;}var old=pw.querySelector('.'+P+'-edm');if(old)old.remove();var isNew=!entry;var data=entry?Object.assign({},entry):Object.assign({name:'',content:'',keys:''},RT.entryDef);var self=this;var m=this.el('div',P+'-card '+P+'-edm');m.style.borderColor='#9A63D5';m.appendChild(this.el('div','',isNew?'➕ 新增':'✏️ 编辑：'+_dn(data))).style.cssText='font-weight:600;color:#9A63D5;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #FEE1A1';
        m.appendChild(this.el('div',P+'-lbl','名称 *'));var inpN=this.inp(data.name||'');m.appendChild(inpN);m.appendChild(this.el('div',P+'-lbl','关键词'));var inpK=this.inp(_getKeys(data));m.appendChild(inpK);
        var nr=this.el('div',P+'-row');var inpD=this.inp(String(_dep(data)!=null?_dep(data):4));inpD.type='number';inpD.style.flex='1';var inpO=this.inp(String(_ord(data)));inpO.type='number';inpO.style.flex='1';var gd=this.el('div',P+'-grp');gd.style.flex='1';gd.appendChild(this.el('div',P+'-lbl','深度'));gd.appendChild(inpD);var go=this.el('div',P+'-grp');go.style.flex='1';go.appendChild(this.el('div',P+'-lbl','排序'));go.appendChild(inpO);nr.appendChild(gd);nr.appendChild(go);m.appendChild(nr);
        m.appendChild(this.el('div',P+'-lbl','激活模式'));var rn=_genId(),rdC=this.radio(rn,_isCon(data)),rdS=this.radio(rn,!_isCon(data));var rg=this.el('div',P+'-rg');var lC=document.createElement('label');lC.appendChild(rdC);lC.appendChild(document.createTextNode(' 🔵 永久'));var lS=document.createElement('label');lS.appendChild(rdS);lS.appendChild(document.createTextNode(' 🟢 关键词'));rg.appendChild(lC);rg.appendChild(lS);m.appendChild(rg);
        var ckE=this.chk(_isOn(data));var lE=document.createElement('label');lE.appendChild(ckE);lE.appendChild(document.createTextNode(' 启用'));lE.style.cssText='font-size:12px;margin:8px 0;display:flex;align-items:center;gap:6px';m.appendChild(lE);
        m.appendChild(this.el('div',P+'-lbl','内容'));var taC=this.ta(data.content||'','120px');m.appendChild(taC);
        var br=this.el('div',P+'-row');br.style.cssText='justify-content:flex-end;margin-top:12px;gap:10px';br.appendChild(this.btn('💾 保存',P+'-bp',async function(){var name=inpN.value.trim();if(!name){alert('名称不能为空');return;}var isCon=rdC.checked,keys=inpK.value.trim();var fields={name:name,keys:keys||(isCon?'':name),depth:parseInt(inpD.value)||4,order:parseInt(inpO.value)||200,content:taC.value,enabled:ckE.checked,constant:isCon,selective:!isCon,comment:NS+name,context:parseInt(inpD.value)||4};try{if(isNew)await Book.addEntry(bk,fields);else{var mg={};for(var k in entry)mg[k]=entry[k];for(var k2 in fields)mg[k2]=fields[k2];await Book.updateEntry(bk,mg);}m.remove();self.refresh();}catch(e){alert(e.message);}}));
        br.appendChild(this.btn('↩️ 取消',P+'-bg',function(){m.remove();}));m.appendChild(br);pw.insertBefore(m,pw.children[1]||null);inpN.focus();},

        // Tab 1: 提示词
        _tPrompts:function(c){var self=this,w=this.el('div'),entries=RT.promptEntries;w.appendChild(this.el('div',P+'-info')).innerHTML='提示词条目按<b>序号</b>升序排列，<b>user</b>类型的触发指令会在对话历史之后发送。<br>占位符: <code>{current_worldbook_summary}</code>';var lw=this.el('div');
        var render=function(){lw.innerHTML='';var sorted=entries.slice().sort(function(a,b){return(a.order||0)-(b.order||0);});sorted.forEach(function(pe){var it=self.el('div',P+'-pe'+(pe.enabled?'':' dis'));var head=self.el('div',P+'-pe-head');var ck=self.chk(pe.enabled!==false);ck.onchange=function(){pe.enabled=ck.checked;Store.savePromptEntries(entries);it.className=P+'-pe'+(ck.checked?'':' dis');};head.appendChild(ck);var nameSpan=self.el('span',P+'-en',pe.name||'(未命名)');nameSpan.style.cursor='pointer';head.appendChild(nameSpan);head.appendChild(self.el('span',P+'-tag '+P+'-tgy',pe.role||'system'));head.appendChild(self.el('span',P+'-tag '+P+'-tgy','#'+(pe.order||0)));if(pe.builtin)head.appendChild(self.el('span',P+'-tag '+P+'-tbl','内置'));head.appendChild(self.btn('✏️',P+'-bg',function(){self._promptEditor(w,lw,pe,render);}));if(!pe.builtin)head.appendChild(self.btn('🗑',P+'-bd2',function(){if(!confirm('删除？'))return;var idx2=entries.indexOf(pe);if(idx2!==-1)entries.splice(idx2,1);Store.savePromptEntries(entries);render();}));it.appendChild(head);var body=self.el('div',P+'-pe-body');var pv=(pe.content||'').slice(0,200).replace(/\n/g,' ');body.appendChild(self.el('div',P+'-lbl',pv+(pe.content&&pe.content.length>200?'…':'')));it.appendChild(body);nameSpan.onclick=function(){it.classList.toggle('open');};lw.appendChild(it);});};render();w.appendChild(lw);
        var br=this.el('div',P+'-row');br.style.marginTop='8px';br.appendChild(this.btn('➕ 添加条目',P+'-bp',function(){var ne={id:_genId(),name:'',role:'system',content:'',order:50,enabled:true,builtin:false};entries.push(ne);Store.savePromptEntries(entries);self._promptEditor(w,lw,ne,render);}));br.appendChild(this.btn('↩️ 恢复默认',P+'-bg',function(){if(!confirm('恢复内置条目？自定义保留。'))return;var customs=entries.filter(function(pe){return!pe.builtin;});RT.promptEntries=JSON.parse(JSON.stringify(DEFAULT_PROMPT_ENTRIES)).concat(customs);entries=RT.promptEntries;Store.savePromptEntries(entries);render();}));w.appendChild(br);c.appendChild(w);},

        _promptEditor:function(pw,lw,pe,onSave){var old=pw.querySelector('.'+P+'-pem');if(old)old.remove();var self=this;var ed=this.el('div',P+'-card '+P+'-pem');ed.style.borderColor='#9A63D5';ed.appendChild(this.el('div','','✏️ 编辑提示词条目')).style.cssText='font-weight:600;color:#9A63D5;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #FEE1A1';ed.appendChild(this.el('div',P+'-lbl','名称'));var iN=this.inp(pe.name||'');ed.appendChild(iN);var mr=this.el('div',P+'-row');var sel=document.createElement('select');sel.className=P+'-sel';['system','user','assistant'].forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(pe.role===r)o.selected=true;sel.appendChild(o);});var iO=this.inp(String(pe.order||0));iO.type='number';iO.style.flex='1';var g1=this.el('div',P+'-grp');g1.style.flex='1';g1.appendChild(this.el('div',P+'-lbl','角色'));g1.appendChild(sel);var g2=this.el('div',P+'-grp');g2.style.flex='1';g2.appendChild(this.el('div',P+'-lbl','序号'));g2.appendChild(iO);mr.appendChild(g1);mr.appendChild(g2);ed.appendChild(mr);ed.appendChild(this.el('div',P+'-lbl','内容'));var taC=this.ta(pe.content||'','100px');ed.appendChild(taC);var br=this.el('div',P+'-row');br.style.cssText='justify-content:flex-end;margin-top:12px;gap:10px';br.appendChild(this.btn('💾 保存',P+'-bp',function(){pe.name=iN.value.trim();pe.role=sel.value;pe.order=parseInt(iO.value)||0;pe.content=taC.value;Store.savePromptEntries(RT.promptEntries);ed.remove();onSave();}));br.appendChild(this.btn('↩️ 取消',P+'-bg',function(){ed.remove();}));ed.appendChild(br);if(lw.nextSibling)pw.insertBefore(ed,lw.nextSibling);else pw.appendChild(ed);iN.focus();},

        // Tab 2: API
        _tAPI:function(c){var a=RT.api,cfg=RT.cfg,self=this,w=this.el('div');w.appendChild(this.el('div',P+'-info')).innerHTML='当前: <b>'+(cfg.mode==='inline'?'🏠 主API':'🌐 外部('+cfg.apiSource+')')+'</b>';
        w.appendChild(this.coll('🔄 更新模式',true,function(){var b=self.el('div'),rn=_genId(),g=self.el('div',P+'-rg');var mk=function(v,l){var lb=document.createElement('label'),rd=self.radio(rn,cfg.mode===v);rd.onchange=function(){if(rd.checked){cfg.mode=v;Store.saveConfig(cfg);self.switchTab(2);}};lb.appendChild(rd);lb.appendChild(document.createTextNode(' '+l));return lb;};g.appendChild(mk('inline','🏠 主API'));g.appendChild(mk('external','🌐 外部'));b.appendChild(g);return b;}));
        if(cfg.mode==='external'){w.appendChild(this.coll('📡 来源',true,function(){var b=self.el('div'),rn=_genId(),g=self.el('div',P+'-rg');var mk=function(v,l){var lb=document.createElement('label'),rd=self.radio(rn,cfg.apiSource===v);rd.onchange=function(){if(rd.checked){cfg.apiSource=v;Store.saveConfig(cfg);self.switchTab(2);}};lb.appendChild(rd);lb.appendChild(document.createTextNode(' '+l));return lb;};g.appendChild(mk('tavern','🏠 酒馆'));g.appendChild(mk('custom','🔌 自定义'));b.appendChild(g);return b;}));}
        var showC=cfg.mode==='external'&&cfg.apiSource==='custom';
        w.appendChild(this.coll('🔌 自定义API'+(showC?'':' (未启用)'),showC,function(){var b=self.el('div'),trn=_genId();b.appendChild(self.el('div',P+'-lbl','类型'));var tg=self.el('div',P+'-rg');var types={openai:'OpenAI兼容',gemini:'Gemini'};for(var t in types)(function(tp){var lb=document.createElement('label'),rd=self.radio(trn,a.type===tp);rd.dataset.at=tp;lb.appendChild(rd);lb.appendChild(document.createTextNode(' '+types[tp]));tg.appendChild(lb);})(t);b.appendChild(tg);b.appendChild(this.el('div',P+'-lbl','端点'));var iE=self.inp(a.endpoint||'');iE.dataset.af='endpoint';b.appendChild(iE);b.appendChild(this.el('div',P+'-lbl','密钥'));var iK=self.inp(a.key||'');iK.type='password';iK.dataset.af='key';b.appendChild(iK);b.appendChild(this.el('div',P+'-lbl','模型'));var iM=self.inp(a.model||'');iM.dataset.af='model';b.appendChild(iM);var nr=self.el('div',P+'-row');var mkP=function(l,v,af){var g=self.el('div',P+'-grp');g.style.flex='1';g.appendChild(this.el('div',P+'-lbl',l));var i=self.inp(String(v));i.type='number';i.dataset.af=af;g.appendChild(i);return g;}.bind(this);nr.appendChild(mkP('MaxToken',a.maxTokens||4096,'maxTokens'));nr.appendChild(mkP('温度',a.temperature||0.7,'temperature'));nr.appendChild(mkP('超时(s)',Math.round((a.timeoutMs||120000)/1000),'timeoutSec'));b.appendChild(nr);var br2=self.el('div',P+'-row');br2.style.cssText='justify-content:flex-end;gap:10px;margin-top:12px';
        br2.appendChild(this.btn('🔗 测试',P+'-bp',async function(){try{var tc=Object.assign({},a);b.querySelectorAll('input[name="'+trn+'"]').forEach(function(rd){if(rd.checked)tc.type=rd.dataset.at;});b.querySelectorAll('[data-af]').forEach(function(el){var f=el.dataset.af;if(f==='maxTokens')tc.maxTokens=parseInt(el.value)||4096;else if(f==='temperature')tc.temperature=parseFloat(el.value)||0.7;else if(f==='timeoutSec')tc.timeoutMs=(parseInt(el.value)||120)*1000;else tc[f]=el.value;});var r=await API.call([{role:'user',content:'Reply OK'}],Object.assign(tc,{apiSource:'custom'}),null);alert('✅ '+r.slice(0,100));}catch(e){alert('❌ '+e.message);}}));
        br2.appendChild(this.btn('💾 保存',P+'-bp',function(){b.querySelectorAll('input[name="'+trn+'"]').forEach(function(rd){if(rd.checked)a.type=rd.dataset.at;});b.querySelectorAll('[data-af]').forEach(function(el){var f=el.dataset.af;if(f==='maxTokens')a.maxTokens=parseInt(el.value)||4096;else if(f==='temperature')a.temperature=parseFloat(el.value)||0.7;else if(f==='timeoutSec')a.timeoutMs=(parseInt(el.value)||120)*1000;else a[f]=el.value;});Store.saveApi(a);Toast.show('✅ 已保存','success');}));b.appendChild(br2);return b;}.bind(this)));c.appendChild(w);},

        // Tab 3: 设置
        _tSettings:function(c){var cfg=RT.cfg,self=this,w=this.el('div');
        w.appendChild(this.coll('🔄 自动更新',false,function(){var b=self.el('div');var sr=self.el('div',P+'-row');sr.appendChild(self.el('span','','启用自动更新')).style.cssText='flex:1;font-weight:500';var sw=self.el('label',P+'-sw');var swi=document.createElement('input');swi.type='checkbox';swi.checked=cfg.autoEnabled;swi.dataset.sf='autoEnabled';sw.appendChild(swi);sw.appendChild(self.el('span','sl'));sr.appendChild(sw);b.appendChild(sr);b.appendChild(self.el('div',P+'-lbl','触发时机'));var fr=self.el('div',P+'-row');var mkN=function(l,f,v){var g=self.el('div',P+'-grp');g.style.flex='1';g.appendChild(self.el('div',P+'-lbl',l));var i=self.inp(String(v));i.type='number';i.min='0';i.dataset.sf=f;g.appendChild(i);return{el:g,inp:i};};var s=mkN('起始楼层','startAfter',cfg.startAfter),i=mkN('间隔(0=每层)','interval',cfg.interval);fr.appendChild(s.el);fr.appendChild(i.el);b.appendChild(fr);var pv=self.el('div',P+'-lbl');pv.style.cssText='color:#6e9fff;font-size:11px';pv.textContent='📍 预计: '+_previewFloors(cfg.startAfter,cfg.interval,6);var up=function(){pv.textContent='📍 预计: '+_previewFloors(parseInt(s.inp.value)||0,parseInt(i.inp.value),6);};s.inp.oninput=up;i.inp.oninput=up;b.appendChild(pv);return b;}));
        w.appendChild(this.coll('📚 目标世界书',false,function(){var b=self.el('div'),bks=Book.getAvailableBooks(),trn=_genId();b.appendChild(self.el('div',P+'-lbl','类型'));var tg=self.el('div',P+'-rg');[{v:'charPrimary',l:'👤 角色世界书'},{v:'charAdditional',l:'📎 附加世界书'},{v:'global',l:'🌍 全局世界书'},{v:'managed',l:'📝 托管书'}].forEach(function(t){var lb=document.createElement('label'),rd=self.radio(trn,cfg.targetType===t.v);rd.dataset.tt=t.v;lb.appendChild(rd);lb.appendChild(document.createTextNode(' '+t.l));tg.appendChild(lb);});b.appendChild(tg);var nameDiv=self.el('div');nameDiv.style.display=(cfg.targetType==='charAdditional'||cfg.targetType==='global')?'block':'none';nameDiv.appendChild(self.el('div',P+'-lbl','名称'));var iBk=self.inp(cfg.targetBookName||'');iBk.dataset.sf='targetBookName';var dlId=_genId();iBk.setAttribute('list',dlId);var dl=document.createElement('datalist');dl.id=dlId;bks.forEach(function(bk){var o=document.createElement('option');o.value=bk.name;dl.appendChild(o);});nameDiv.appendChild(iBk);nameDiv.appendChild(dl);b.appendChild(nameDiv);tg.querySelectorAll('input[type="radio"]').forEach(function(rd){rd.addEventListener('change',function(){nameDiv.style.display=(rd.dataset.tt==='charAdditional'||rd.dataset.tt==='global')?'block':'none';});});var st=self.el('div',P+'-lbl');st.style.marginTop='8px';Book.getTargetBookName().then(function(bk){st.innerHTML=bk?'✅ 目标: <b style="color:#4caf50">'+_esc(bk)+'</b>':'⚠️ <span style="color:#ff9800">未找到</span>';}).catch(function(){st.innerHTML='❌';});b.appendChild(st);return b;}));
        w.appendChild(this.coll('🔍 审核设置',false,function(){var b=self.el('div');var mk=function(l,f,v,d2){var g=self.el('div',P+'-grp');g.appendChild(self.el('div',P+'-lbl',l));var i=self.inp(String(v));i.type='number';i.min='1';i.dataset.sf=f;g.appendChild(i);if(d2){g.appendChild(self.el('div',P+'-lbl',d2)).style.fontSize='10px';}b.appendChild(g);};mk('审核深度','reviewDepth',cfg.reviewDepth,'最近多少条消息');mk('单次最大创建','maxCreatePerRound',cfg.maxCreatePerRound,'');var cr=self.el('div',P+'-row');var mkCk=function(l,f,v){var lb=document.createElement('label');lb.style.cssText='display:flex;align-items:center;gap:6px;font-size:12px';var ck=self.chk(v);ck.dataset.sf=f;lb.appendChild(ck);lb.appendChild(document.createTextNode(l));return lb;};cr.appendChild(mkCk('删除确认','confirmDelete',cfg.confirmDelete));cr.appendChild(mkCk('更新确认','confirmUpdate',cfg.confirmUpdate));b.appendChild(cr);return b;}));
        w.appendChild(this.coll('⚙ 功能开关',false,function(){var b=self.el('div');var mkToggle=function(l,f,v){var sr=self.el('div',P+'-row');sr.appendChild(self.el('span','',l)).style.cssText='flex:1';var sw=self.el('label',P+'-sw');var swi=document.createElement('input');swi.type='checkbox';swi.checked=v!==false;swi.dataset.sf=f;sw.appendChild(swi);sw.appendChild(self.el('span','sl'));sr.appendChild(sw);b.appendChild(sr);};mkToggle('AI 条目追踪','aiRegistryEnabled',cfg.aiRegistryEnabled);mkToggle('聊天世界书隔离','chatIsolationEnabled',cfg.chatIsolationEnabled);mkToggle('AI 操作前自动备份','autoBackupBeforeAI',cfg.autoBackupBeforeAI);mkToggle('条目锁定功能','entryLockEnabled',cfg.entryLockEnabled);mkToggle('Token 用量估算','tokenEstimateEnabled',cfg.tokenEstimateEnabled);mkToggle('消息删除同步回滚','syncOnDelete',cfg.syncOnDelete);b.appendChild(self.el('div',P+'-lbl','审核模式'));var am=self.el('select',P+'-sel');am.dataset.sf='approvalMode';var amOpts=[{v:'auto',l:'自动'},{v:'manual',l:'手动'},{v:'selective',l:'选择性'}];amOpts.forEach(function(opt){var o=document.createElement('option');o.value=opt.v;o.textContent=opt.l;if(cfg.approvalMode===opt.v)o.selected=true;am.appendChild(o);});b.appendChild(am);return b;}));
        w.appendChild(this.coll('📝 提示词过滤',false,function(){var b=self.el('div');b.appendChild(self.el('div',P+'-info')).innerHTML='控制发送给AI的内容，可减少token消耗并提高准确性。';var mkCk=function(l,f,v){var lb=document.createElement('label');lb.style.cssText='display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px';var ck=self.chk(v);ck.dataset.sf=f;lb.appendChild(ck);lb.appendChild(document.createTextNode(l));return lb;};b.appendChild(mkCk('不发送蓝灯（永久）条目给AI','excludeConstantFromPrompt',cfg.excludeConstantFromPrompt));b.appendChild(mkCk('仅发送直接触发的条目（排除递归触发）','directTriggerOnly',cfg.directTriggerOnly));b.appendChild(mkCk('发送用户聊天记录','sendUserMessages',cfg.sendUserMessages));b.appendChild(mkCk('发送AI聊天记录','sendAiMessages',cfg.sendAiMessages));b.appendChild(mkCk('更新后自动验证写入','autoVerifyAfterUpdate',cfg.autoVerifyAfterUpdate));b.appendChild(self.el('div',P+'-lbl','刷新模式'));var rm=self.el('select',P+'-sel');rm.dataset.sf='refreshMode';var rmOpts=[{v:'soft',l:'轻量（无闪烁）'},{v:'full',l:'完整'},{v:'none',l:'不刷新'}];rmOpts.forEach(function(opt){var o=document.createElement('option');o.value=opt.v;o.textContent=opt.l;if(cfg.refreshMode===opt.v)o.selected=true;rm.appendChild(o);});b.appendChild(rm);return b;}));
        w.appendChild(this.coll('📋 上下文模式',false,function(){var b=self.el('div');b.appendChild(self.el('div',P+'-lbl','条目发送模式'));var tg=self.el('div',P+'-rg');[{v:'full',l:'📋 全部 — 发送所有条目的完整内容'},{v:'triggered',l:'🎯 触发 — 仅发送关键词匹配到的条目'},{v:'summary',l:'📝 摘要 — 仅发送条目元数据（不含内容）'}].forEach(function(md){var lb=document.createElement('label'),rd=self.radio('ctxMode',cfg.contextMode===md.v);rd.dataset.cm=md.v;lb.appendChild(rd);lb.appendChild(document.createTextNode(' '+md.l));tg.appendChild(lb);});b.appendChild(tg);b.appendChild(self.el('div',P+'-lbl','单条目内容截断（字符数，0=不限制）'));var maxChars=self.inp(String(cfg.maxContentChars||0));maxChars.type='number';maxChars.min='0';maxChars.dataset.sf='maxContentChars';b.appendChild(maxChars);b.appendChild(self.el('div',P+'-lbl','追加重复防护（patch append 防重复）'));var dupGuard=self.chk(cfg.patchDuplicateGuard!==false);dupGuard.dataset.sf='patchDuplicateGuard';b.appendChild(dupGuard);var info=self.el('div',P+'-info');info.innerHTML='📋全部：AI可看到所有条目内容，最准确但消耗较多token。<br>🎯触发：扫描最近聊天内容，仅发送关键词命中的条目，省token。<br>📝摘要：仅发送条目名称和元数据，最省token但AI无法看到内容。';b.appendChild(info);return b;}));
        w.appendChild(this.coll('🏷️ 消息内容过滤',false,function(){var b=self.el('div');b.appendChild(self.el('div',P+'-info')).innerHTML='<b>不过滤</b>：完整文本<br><b>仅提取</b>：只发指定标签内容<br><b>排除</b>：去掉指定标签内容<br>标签名逗号分隔，不含尖括号';b.appendChild(self.el('div',P+'-lbl','过滤模式'));var modeRn=_genId();var modeG=self.el('div',P+'-rg');[{v:'none',l:'不过滤'},{v:'include',l:'仅提取指定标签'},{v:'exclude',l:'排除指定标签'}].forEach(function(md){var lb=document.createElement('label'),rd=self.radio(modeRn,cfg.contentFilterMode===md.v);rd.dataset.fm=md.v;lb.appendChild(rd);lb.appendChild(document.createTextNode(' '+md.l));modeG.appendChild(lb);});b.appendChild(modeG);b.appendChild(self.el('div',P+'-lbl','标签名（逗号分隔）'));var tagInp=self.inp(cfg.contentFilterTags||'','例: content 或 thinking,recap,choice');tagInp.dataset.sf='contentFilterTags';b.appendChild(tagInp);var pvDiv=self.el('div',P+'-info');pvDiv.style.marginTop='8px';var updatePv=function(){var selMode='none';modeG.querySelectorAll('input[type="radio"]').forEach(function(rd){if(rd.checked)selMode=rd.dataset.fm;});var selTags=tagInp.value.trim();if(selMode==='none'||!selTags)pvDiv.innerHTML='📖 发送完整消息';else if(selMode==='include')pvDiv.innerHTML='📖 只提取 <b>&lt;'+_esc(selTags.split(',').join('&gt;</b>, <b>&lt;'))+'&gt;</b>';else pvDiv.innerHTML='📖 移除 <b>&lt;'+_esc(selTags.split(',').join('&gt;</b>, <b>&lt;'))+'&gt;</b>';};updatePv();tagInp.oninput=updatePv;modeG.querySelectorAll('input[type="radio"]').forEach(function(rd){rd.onchange=updatePv;});b.appendChild(pvDiv);return b;}));
        w.appendChild(this.coll('🪟 悬浮窗设置',false,function(){var b=self.el('div');var sr=self.el('div',P+'-row');sr.appendChild(self.el('span','','启用悬浮窗')).style.cssText='flex:1;font-weight:500';var sw=self.el('label',P+'-sw');var swi=document.createElement('input');swi.type='checkbox';swi.checked=cfg.fabEnabled!==false;swi.dataset.sf='fabEnabled';sw.appendChild(swi);sw.appendChild(self.el('span','sl'));sr.appendChild(sw);b.appendChild(sr);var info=self.el('div',P+'-info');info.innerHTML='启用：显示悬浮窗，可点击打开面板<br>禁用：不显示悬浮窗，可通过扩展菜单打开面板';b.appendChild(info);return b;}));
        var br=this.el('div',P+'-row');br.style.cssText='justify-content:center;gap:10px;margin-top:16px';br.appendChild(this.btn('💾 保存',P+'-bp',function(){var oldFabEnabled=cfg.fabEnabled;c.querySelectorAll('[data-sf]').forEach(function(el){var k=el.dataset.sf;if(el.type==='checkbox')cfg[k]=el.checked;else if(el.type==='number'){var v=parseInt(el.value);cfg[k]=isNaN(v)?0:v;}else cfg[k]=el.value;});c.querySelectorAll('[data-tt]').forEach(function(rd){if(rd.checked)cfg.targetType=rd.dataset.tt;});c.querySelectorAll('[data-fm]').forEach(function(rd){if(rd.checked)cfg.contentFilterMode=rd.dataset.fm;});c.querySelectorAll('[data-cm]').forEach(function(rd){if(rd.checked)cfg.contextMode=rd.dataset.cm;});Store.saveConfig(cfg);RT.nextUpdateAiFloor=Sched.nextUp(_aiFloor());self.status();
        // 如果悬浮窗设置改变，只更新悬浮窗，不重新构建整个UI
        if(oldFabEnabled!==cfg.fabEnabled){var $oldFab=$('#'+P+'-fab');if($oldFab.length)$oldFab.remove();if(cfg.fabEnabled!==false){var $fab=$('<button id="'+P+'-fab" title="WBM"></button>');$fab.appendTo('body');UI.fab=$fab[0];UI._initDrag();$fab.on('click',function(){UI.toggle();});}else{UI.fab=null;}}
        Toast.show('✅ 已保存','success');}));w.appendChild(br);c.appendChild(w);},

        // Tab 4: 后台
        _tBackend:function(c){var self=this,w=this.el('div');w.appendChild(this.el('div',P+'-info')).innerHTML='WBM与AI的通信记录。';if(RT.backendChats.length===0){w.appendChild(this.el('div',P+'-empty','📭 暂无通信记录'));c.appendChild(w);return;}var sel=document.createElement('select');sel.className=P+'-sel';RT.backendChats.forEach(function(ch,i){var o=document.createElement('option');o.value=String(i);o.textContent=new Date(ch.time).toLocaleString()+' | 第'+ch.floor+'楼 | '+(ch.commands.length?ch.commands.length+'条指令':'无更新');sel.appendChild(o);});w.appendChild(sel);var chatArea=this.el('div');chatArea.style.cssText='max-height:500px;overflow-y:auto;margin-top:8px';
        var renderChat=function(idx){chatArea.innerHTML='';var ch=RT.backendChats[idx];if(!ch)return;chatArea.appendChild(self.el('div',P+'-lbl','📤 发送 ('+ch.messages.length+'条)'));ch.messages.forEach(function(m){var cls=m.role==='system'?P+'-chat-sys':m.role==='user'?P+'-chat-usr':P+'-chat-ast';var bubble=self.el('div',cls);bubble.appendChild(self.el('div',P+'-chat-role',m.role));bubble.appendChild(document.createTextNode(m.content));chatArea.appendChild(bubble);});chatArea.appendChild(self.el('div',P+'-lbl','📥 AI回复'));var rb=self.el('div',P+'-chat-ast');rb.appendChild(self.el('div',P+'-chat-role','assistant'));rb.appendChild(document.createTextNode(ch.reply||'(空)'));chatArea.appendChild(rb);if(ch.commands.length>0){chatArea.appendChild(self.el('div',P+'-lbl','📊 '+ch.commands.length+'条指令'));ch.commands.forEach(function(cmd){var d=self.el('div',P+'-card');d.innerHTML=({create:'➕',update:'🔄','delete':'🗑'}[cmd.action]||'❓')+' <b>'+cmd.action+'</b> 「'+_esc(cmd.entry_name)+'」';if(cmd.fields){var pre=self.el('div',P+'-dbg');pre.textContent=JSON.stringify(cmd.fields,null,2);d.appendChild(pre);}chatArea.appendChild(d);});}};sel.onchange=function(){renderChat(parseInt(sel.value));};renderChat(0);w.appendChild(chatArea);c.appendChild(w);},

        // Tab 5: 调试
        _tDebug:function(c){var self=this,w=this.el('div');var li=this.el('div',P+'-card');li.style.cssText='display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px';var mk=function(ic,lb,vl){var s=self.el('div','');s.innerHTML='<span style="font-size:16px">'+ic+'</span><br><span style="font-size:10px;color:#8892a8">'+lb+'</span><br><b>'+_esc(vl)+'</b>';s.style.textAlign='center';return s;};li.appendChild(mk('📍','AI楼',String(_aiFloor())));li.appendChild(mk('⏮','上次',String(RT.lastProcessedAiFloor)));li.appendChild(mk('⏭','下次',String(RT.nextUpdateAiFloor)));li.appendChild(mk('🔄','自动',RT.cfg.autoEnabled?'开':'关'));li.appendChild(mk('💬','记录',String(RT.backendChats.length)));if(RT._diagData)li.appendChild(mk('🔵','蓝灯',RT._diagData.totalConstantTruthy+'/'+RT._diagData.total));w.appendChild(li);
        var srcInfo=this.el('div',P+'-info');var chatArr=_getChatArray();var fDesc=RT.cfg.contentFilterMode==='none'?'不过滤':RT.cfg.contentFilterMode==='include'?'仅:'+RT.cfg.contentFilterTags:'排除:'+RT.cfg.contentFilterTags;srcInfo.innerHTML='<b>源:</b> '+(chatArr?'✅ST('+chatArr.length+')':'⚠️DOM')+' | <b>ID:</b> '+(_getChatId()||'?')+' | <b>过滤:</b> '+fDesc;w.appendChild(srcInfo);
        var db=RT.lastDebug;if(!db){w.appendChild(this.el('div',P+'-empty','📭 暂无调试数据'));c.appendChild(w);return;}var info=this.el('div',P+'-card');info.innerHTML='🕐 '+new Date(db.time).toLocaleTimeString()+' | 第'+db.floor+'楼 | '+db.mode+' | '+(db.parsed?db.parsed.length:0)+'条';w.appendChild(info);
        w.appendChild(this.coll('📤 发送',false,function(){var b=self.el('div');if(Array.isArray(db.sent))db.sent.forEach(function(m){b.appendChild(self.el('div',P+'-lbl')).innerHTML='<b style="color:'+(m.role==='system'?'#6e9fff':m.role==='user'?'#4caf50':'#ff9800')+'">'+m.role+'</b>';var pre=self.el('div',P+'-dbg');pre.textContent=m.content;b.appendChild(pre);});else b.appendChild(self.el('div',P+'-dbg',String(db.sent)));return b;}));
        w.appendChild(this.coll('📥 返回',false,function(){var b=self.el('div');var pre=self.el('div',P+'-dbg');pre.textContent=db.received||'(空)';b.appendChild(pre);return b;}));
        w.appendChild(this.coll('📊 解析',true,function(){var b=self.el('div');if(!db.parsed||!db.parsed.length){b.textContent='无指令';return b;}db.parsed.forEach(function(cmd){var cd=self.el('div',P+'-card');cd.innerHTML=({create:'➕',update:'🔄','delete':'🗑'}[cmd.action]||'❓')+' <b>'+cmd.action+'</b> 「'+_esc(cmd.entry_name)+'」';if(cmd.fields){var pre=self.el('div',P+'-dbg');pre.textContent=JSON.stringify(cmd.fields,null,2);cd.appendChild(pre);}b.appendChild(cd);});return b;}));c.appendChild(w);},

        // Tab 6: 日志
        _tLog:function(c){var self=this,w=this.el('div'),logs=Store.loadLog();var ok=logs.filter(function(l){return l.status==='ok';}).length,er=logs.filter(function(l){return l.status==='error';}).length;w.appendChild(this.el('div',P+'-card')).innerHTML='📝 <b>'+logs.length+'</b>条 ✅<b style="color:#4caf50">'+ok+'</b> ❌<b style="color:#f44336">'+er+'</b>';var fi=this.inp('','🔍 搜索...');fi.style.marginBottom='8px';w.appendChild(fi);var lw=this.el('div',P+'-card');lw.style.cssText='max-height:360px;overflow-y:auto;padding:6px 12px';
        var render=function(filter){lw.innerHTML='';var items=logs.slice().reverse();if(filter){var kw=filter.toLowerCase();items=items.filter(function(l){return((l.name||'')+(l.action||'')+(l.reason||'')).toLowerCase().indexOf(kw)!==-1;});}if(!items.length){lw.textContent='暂无';return;}items.forEach(function(l){var it=self.el('div',P+'-li');var ts=new Date(l.ts).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});it.innerHTML='<span style="color:#6b7280;font-size:11px">'+ts+'</span> 第'+(l.floor!=null?l.floor:'?')+'楼 '+({create:'➕',update:'🔄','delete':'🗑',error:'❌',review:'🔍',manual:'🤖'}[l.action]||'📝')+' <b>'+_esc(l.action)+'</b> 「'+_esc(l.name||'')+'」 <span class="'+(l.status==='ok'?P+'-lok':l.status==='error'?P+'-ler':P+'-lsk')+'">'+_esc(l.status||'')+'</span>'+(l.detail||l.reason?'<div style="font-size:11px;color:#8892a8;margin-top:2px">'+_esc(l.detail||l.reason)+'</div>':'');lw.appendChild(it);});};fi.oninput=function(){render(fi.value.trim());};render('');w.appendChild(lw);
        var br=this.el('div',P+'-row');br.appendChild(this.btn('📋 导出',P+'-bg',function(){try{navigator.clipboard.writeText(JSON.stringify(logs,null,2));Toast.show('✅ 已复制','success');}catch(e){}}));br.appendChild(this.btn('🗑 清空',P+'-bd2',function(){if(!confirm('确认清空？'))return;Store.saveLog([]);self.refresh();}));w.appendChild(br);c.appendChild(w);},

        // 拖动功能
        _initDrag:function(){var self=this,fab=this.fab;if(!fab)return;
        var isDragging=false,startX=0,startY=0,offsetX=0,offsetY=0;
        
        // 确保fab有正确的定位
        fab.style.position='fixed';
        
        // 鼠标按下事件
        fab.addEventListener('mousedown',function(ev){if(ev.button!==0)return;isDragging=false;startX=ev.clientX;startY=ev.clientY;var rect=fab.getBoundingClientRect();offsetX=startX-rect.left;offsetY=startY-rect.top;fab.style.cursor='grabbing';fab.style.userSelect='none';});
        
        // 鼠标移动事件
        var handleMouseMove=function(ev){if(!fab)return;if(!isDragging&&(Math.abs(ev.clientX-startX)>5||Math.abs(ev.clientY-startY)>5)){isDragging=true;}
        if(isDragging){var x=ev.clientX-offsetX;var y=ev.clientY-offsetY;
        // 限制在视口内
        var viewportWidth=window.innerWidth;var viewportHeight=window.innerHeight;var fabWidth=fab.offsetWidth;var fabHeight=fab.offsetHeight;
        x=Math.max(0,Math.min(x,viewportWidth-fabWidth));y=Math.max(0,Math.min(y,viewportHeight-fabHeight));
        // 使用fixed定位更新位置
        fab.style.left=x+'px';fab.style.top=y+'px';fab.style.bottom='auto';fab.style.right='auto';}};
        
        // 鼠标释放事件
        var handleMouseUp=function(){if(!fab)return;if(isDragging){isDragging=false;fab.style.cursor='pointer';fab.style.userSelect='auto';}fab.style.cursor='pointer';fab.style.userSelect='auto';};
        
        // 添加事件监听器
        document.addEventListener('mousemove',handleMouseMove);
        document.addEventListener('mouseup',handleMouseUp);
        
        // 触摸事件支持
        fab.addEventListener('touchstart',function(ev){ev.preventDefault();if(!ev.touches[0])return;isDragging=false;var touch=ev.touches[0];startX=touch.clientX;startY=touch.clientY;var rect=fab.getBoundingClientRect();offsetX=startX-rect.left;offsetY=startY-rect.top;fab.style.cursor='grabbing';});
        
        var handleTouchMove=function(ev){if(!fab)return;if(!ev.touches[0])return;if(!isDragging&&(Math.abs(ev.touches[0].clientX-startX)>5||Math.abs(ev.touches[0].clientY-startY)>5)){isDragging=true;ev.preventDefault();}
        if(isDragging){ev.preventDefault();var touch=ev.touches[0];var x=touch.clientX-offsetX;var y=touch.clientY-offsetY;
        var viewportWidth=window.innerWidth;var viewportHeight=window.innerHeight;var fabWidth=fab.offsetWidth;var fabHeight=fab.offsetHeight;
        x=Math.max(0,Math.min(x,viewportWidth-fabWidth));y=Math.max(0,Math.min(y,viewportHeight-fabHeight));
        fab.style.left=x+'px';fab.style.top=y+'px';fab.style.bottom='auto';fab.style.right='auto';}};
        
        var handleTouchEnd=function(){if(!fab)return;if(isDragging){isDragging=false;fab.style.cursor='pointer';}fab.style.cursor='pointer';};
        
        document.addEventListener('touchmove',handleTouchMove,{passive:false});
        document.addEventListener('touchend',handleTouchEnd);
        }
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §18  对外 API                                        ║
    // ╚═══════════════════════════════════════════════════════╝

    var PublicAPI = {
        version: '2.0.0',

        // 世界书操作
        getEntries: function (bk) { return Book.getEntries(bk); },
        addEntry: function (bk, fields) { return Book.addEntry(bk, fields); },
        updateEntry: function (bk, entry) { return Book.updateEntry(bk, entry); },
        deleteEntry: function (bk, uid) { return Book.deleteEntry(bk, uid); },

        // 增量更新
        patchEntry: async function (bk, entryName, ops) {
            var entries = await Book.getEntries(bk);
            var target = Search.exact(entries, entryName) || Search.best(entries, entryName);
            if (!target) throw new Error('未找到条目: ' + entryName);
            var patched = {}; for (var k in target) patched[k] = target[k];
            var result = PatchProcessor.apply(patched, ops);
            if (result.applied > 0) await Book.updateEntry(bk, patched);
            return result;
        },

        // 解析指令
        parseCommands: function (text) { return Parser.parse(text); },
        executeCommands: function (cmds, bk) { return Router.execute(cmds, bk); },

        // 上下文
        buildFullContext: function (bk) { return Prompt.buildFullContext(bk); },
        buildSummary: function (bk) { return Prompt.buildSummary(bk); },
        buildTriggeredContext: function (bk) { return Prompt.buildTriggeredContext(bk); },
        // 关键词扫描
        scanKeywords: function (bk, depth) {
            return Book.getEntries(bk).then(function (entries) {
                var vis = entries.filter(function (e) { return e.comment !== FMT_COMMENT; });
                var scanText = ContextScanner.buildScanText(depth || RT.cfg.reviewDepth || 10);
                if (!scanText) return { triggered: [], total: vis.length, scanText: '' };
                var triggered = ContextScanner.scan(vis, scanText);
                return { triggered: triggered, total: vis.length, scanText: scanText };
            });
        },

        // UI
        openUI: function () { UI.open(); },
        closeUI: function () { UI.close(); },

        // 手动触发
        manualReview: function () { return Sched.manual(); },

        // ★ 新增：写入验证
        verifyBook: function (bk, results) { return BookSync.verify(bk, results); },
        repairBook: function (bk, verifyResult, cmds) { return BookSync.repair(bk, verifyResult, cmds); },

        // ★ 新增：审核队列操作
        getPendingQueue: function () { return PendingQueue.getPending(); },
        getPendingCount: function () { return PendingQueue.count(); },
        approveAll: function () { return PendingQueue.approveAll(); },
        approveOne: function (id, idx) { return PendingQueue.approveOne(id, idx); },
        rejectAll: function () { PendingQueue.rejectAll(); },
        rejectOne: function (id) { return PendingQueue.reject(id); },

        // ★ 快照操作
        getSnapshots: function () { return SnapshotStore._snapshots.slice(); },
        rollbackFloor: function (floor, chatId) { return SnapshotStore.rollback(floor, chatId); },

        // ★ 修正: cleanup 替代原 clear
        cleanupQueue: function () { PendingQueue.cleanup(); },
        clearQueue: function () { PendingQueue.clearAll(); },

        // 聊天隔离
        getIsolationInfo: function () { return ChatIsolation.getCurrentInfo(); },
        getIsolationStats: function (bk) { return ChatIsolation.getStats(bk); },
        clearMyIsolation: function (bk) { return ChatIsolation.clearMine(bk); },
        clearAllIsolation: function (bk) { return ChatIsolation.clearAll(bk); },
        promoteIsolationToGlobal: function (bk) { return ChatIsolation.promoteToGlobal(bk); },

        // 常量
        FULL_ENTRY_TEMPLATE: FULL_ENTRY_TEMPLATE
    };

    // ╔═══════════════════════════════════════════════════════╗
    // ║  §19  初始化                                           ║
    // ╚═══════════════════════════════════════════════════════╝

    function init() {
        _log('WBM 初始化中…');
        loadRT();
        WI.init();
        injectCSS();
        checkDeps();
        _log('依赖: L0=' + RT.depsL0 + ' L1=' + RT.depsL1 + ' L2=' + RT.depsL2 + ' L3=' + RT.depsL3);

        // 即使 L2 就绪，如果 WI 使用的是 native 后端，也启动重检以尝试升级到 TavernHelper
        if (!RT.depsL2 || WI._backend === 'native') {
            startDepsRecheck();
        }

        // ★ 恢复审核队列
        PendingQueue._restore();
        var pc = PendingQueue.count();
        if (pc > 0) _log('恢复 ' + pc + ' 条待审核指令');

        // ★ 恢复快照数据
        SnapshotStore._restore();
        var sc = SnapshotStore._snapshots.length;
        if (sc > 0) _log('恢复 ' + sc + ' 条操作快照');

        // ★ 延迟清理可能残留的格式条目（防止上次崩溃导致的残留）
        setTimeout(async function () {
            try {
                if (RT.depsL2) {
                    var bk = await Book.getTargetBookName();
                    if (bk) {
                        var entries = await Book.getEntries(bk);
                        for (var fi = 0; fi < entries.length; fi++) {
                            if (entries[fi].comment === FMT_COMMENT && _isOn(entries[fi])) {
                                _log('init: 发现残留的已启用格式条目，自动禁用');
                                await FmtGuide.disable(bk);
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                _warn('init: 格式条目清理失败: ' + e.message);
            }
        }, 5000);

        // ★ 初始化楼层与聊天 ID
        RT.lastAiFloor = _aiFloor();
        RT._lastChatId = _getChatId();
        RT.nextUpdateAiFloor = Sched.nextUp(RT.lastAiFloor);
        _log('楼层: 当前=' + RT.lastAiFloor + ' 下次=' + RT.nextUpdateAiFloor);

        // 创建 UI
        UI.build();

        setTimeout(addMenuEntry, 500);
        setTimeout(startObserver, 1000);

        // ★ 绑定事件桥（延迟等待 ST 就绪）
        setTimeout(function () {
            EventBridge.init();
        }, 1500);

        // ★ 延迟刷新状态栏
        setTimeout(function () {
            RT.lastAiFloor = _aiFloor();
            RT.nextUpdateAiFloor = Sched.nextUp(RT.lastAiFloor);
            if (typeof UI !== 'undefined' && UI.status) UI.status();
        }, 3000);

        window.WBM = PublicAPI;
        window.WorldBookManager = PublicAPI;

        _log('✓ 初始化完成');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
    } else {
        setTimeout(init, 300);
    }

})();
