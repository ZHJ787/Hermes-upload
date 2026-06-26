/*
* @File     : jable.js
* @Desc     : Jable.TV 爬虫（简化版，不依赖 jadehh 复杂基类）
* @Note     : 直接用全局 req() 请求，Postman UA 绕过 CF
*/

// === 导入依赖 ===
import {_, load} from '../lib/cat.js';
import {VodShort, VodDetail} from '../lib/vod.js';

// === 配置 ===
const SITE_URL = "https://jable.tv";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const POSTMAN_UA = "PostmanRuntime/7.36.3";
const POSTMAN_HEADERS = {
    "User-Agent": POSTMAN_UA,
    "Host": "jable.tv",
    "Postman-Token": "33290483-3c8d-413f-a160-0d3aea9e6f95"
};

// === 分类配置 ===
const CATEGORIES = [
    { type_id: "latest-updates", type_name: "最新" },
    { type_id: "hot", type_name: "热门" },
    { type_id: "censored", type_name: "有码" },
    { type_id: "uncensored-leak", type_name: "无码流出" },
    { type_id: "chinese-subtitle", type_name: "中文字幕" },
    { type_id: "prestige", type_name: "企划" },
];

// === HTTP 请求 ===
async function httpGet(url, headers = POSTMAN_HEADERS) {
    try {
        const response = await req(url, {
            method: "get",
            headers: headers,
            timeout: 15000
        });
        if (response.code === 200 && response.content) {
            return response.content;
        }
    } catch (e) {
        console.error("httpGet error:", e.message || e);
    }
    return "";
}

// === HTML 解析（用 cheerio / load）===
async function getHtmlDoc(url) {
    const html = await httpGet(url);
    if (!html) return null;
    try {
        return load(html);
    } catch (e) {
        console.error("load html error:", e.message || e);
        return null;
    }
}

// === 解析视频列表 ===
function parseVodList($) {
    const vod_list = [];
    if (!$) return vod_list;
    try {
        const elements = $("div.video-img-box");
        for (const element of elements) {
            try {
                const imgEl = $(element).find("img").first();
                let vod_pic = imgEl.attr("data-src") || imgEl.attr("src") || "";
                if (!vod_pic) continue;

                const aEl = $(element).find("a").first();
                const href = aEl.attr("href") || "";
                if (!href) continue;

                // 从 https://jable.tv/videos/xxx/ 提取 vod_id
                const match = href.match(/\/videos\/([^\/]+)/);
                const vod_id = match ? match[1] : "";
                if (!vod_id) continue;

                let vod_name = vod_id;
                const titleEl = $(element).find(".title a, .detail a, h6").first();
                if (titleEl.length) {
                    const titleText = titleEl.text().trim();
                    if (titleText) vod_name = titleText;
                }

                let vod_remarks = "";
                const remarksEl = $(element).find(".label, .duration, .resolution");
                if (remarksEl.length) {
                    vod_remarks = remarksEl.first().text().trim();
                }
                if (!vod_remarks) vod_remarks = "HD";

                vod_list.push({
                    vod_id: vod_id,
                    vod_name: vod_name,
                    vod_pic: vod_pic,
                    vod_remarks: vod_remarks
                });
            } catch (e) {
                // 跳过单个解析失败的元素
            }
        }
    } catch (e) {
        console.error("parseVodList error:", e.message || e);
    }
    return vod_list;
}

// === 解析详情页 ===
function parseDetail($, id) {
    if (!$) return null;
    try {
        let vod_name = id;
        const titleEl = $("h4.header-left, h6, .title").first();
        if (titleEl.length) {
            const t = titleEl.text().trim();
            if (t) vod_name = t;
        }

        let vod_pic = "";
        const ogImage = $('meta[property="og:image"]').attr("content");
        if (ogImage) vod_pic = ogImage;

        let vod_year = "";
        const yearEl = $(".inactive-color, .info-header span").first();
        if (yearEl.length) vod_year = yearEl.text().trim();

        // 提取 m3u8
        let play_url = "";
        const html = $.html();
        const m = html.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+)['"]/);
        if (m) play_url = m[1];
        if (!play_url) {
            const m2 = html.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i);
            if (m2) play_url = m2[0];
        }

        const vod = {
            vod_id: id,
            vod_name: vod_name,
            vod_pic: vod_pic,
            vod_year: vod_year,
            vod_content: "",
        };
        if (play_url) {
            vod.vod_play_from = "Jable";
            vod.vod_play_url = "播放$" + play_url;
        }
        return vod;
    } catch (e) {
        console.error("parseDetail error:", e.message || e);
        return null;
    }
}

// === Spider 接口实现（TVBox QuickJS 格式）===

let spider = {
    // 分类列表
    async init(cfg) {
        // 简单初始化，不依赖 js2Proxy
    },

    async home(filter) {
        return JSON.stringify({
            class: CATEGORIES.map(c => ({ type_id: c.type_id, type_name: c.type_name })),
            list: []
        });
    },

    async homeVod() {
        const $ = await getHtmlDoc(SITE_URL);
        const list = parseVodList($);
        return JSON.stringify({ list: list });
    },

    async category(tid, pg, filter, extend) {
        const page = parseInt(pg) || 1;
        let url;
        if (tid === "latest-updates" || tid.indexOf("latest-updates") > -1) {
            url = `${SITE_URL}/latest-updates/${page}/`;
        } else if (tid === "hot") {
            url = `${SITE_URL}/hot/${page}/`;
        } else {
            url = `${SITE_URL}/${tid}/${page}/`;
        }
        const $ = await getHtmlDoc(url);
        const list = parseVodList($);
        return JSON.stringify({
            page: page,
            pagecount: page < 100 ? page + 1 : page,
            limit: 24,
            total: 9999,
            list: list
        });
    },

    async detail(id) {
        const url = `${SITE_URL}/videos/${id}/`;
        const $ = await getHtmlDoc(url);
        const vod = parseDetail($, id);
        return JSON.stringify({ list: vod ? [vod] : [] });
    },

    async play(flag, id, flags) {
        // id 就是 m3u8 url（从 detail 的 vod_play_url 传入）
        return JSON.stringify({
            url: id,
            parse: 0,
            header: {
                "User-Agent": POSTMAN_UA,
                "Referer": SITE_URL + "/"
            }
        });
    },

    async search(wd, quick) {
        const url = `${SITE_URL}/search/${wd}/`;
        const $ = await getHtmlDoc(url);
        const list = parseVodList($);
        return JSON.stringify({
            page: 1,
            pagecount: 1,
            limit: 24,
            total: list.length,
            list: list
        });
    },

    async proxy(segments, headers) {
        return "";
    }
};

// === 导出（TVBox QuickJS 格式）===
async function init(cfg) { return await spider.init(cfg); }
async function home(filter) { return await spider.home(filter); }
async function homeVod() { return await spider.homeVod(); }
async function category(tid, pg, filter, extend) { return await spider.category(tid, pg, filter, extend); }
async function detail(id) { return await spider.detail(id); }
async function play(flag, id, flags) { return await spider.play(flag, id, flags); }
async function search(wd, quick) { return await spider.search(wd, quick); }
async function proxy(segments, headers) { return await spider.proxy(segments, headers); }

// TVBox 元数据
function getName() { return "🔞┃Jable┃🔞"; }
function getAppName() { return "Jable"; }
function getJSName() { return "jable"; }
function getType() { return 3; }

export function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search,
        proxy: proxy
    };
}

export { spider };
