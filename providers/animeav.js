var SOURCE_ID = "animeav1";
var SITE = "https://animeav1.com";

function getInfo() {
  return {
    name: "AnimeAV1",
    lang: "es",
    baseUrl: SITE,
    logo: SITE + "/favicon.png",
    type: "anime",
    version: "1.0.0"
  };
}

function abs(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  return SITE + (url.charAt(0) === "/" ? url : "/" + url);
}

function clean(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getPage(url, referer) {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      "Referer": referer || SITE + "/"
    }
  }).then(function (response) {
    if (!response || response.status >= 400) {
      throw new Error("HTTP error");
    }
    return response.text();
  });
}

/* BUSQUEDA */

function search(query, page, options) {
  var q = String(query || "").trim();

  if (!q) {
    return Promise.resolve([]);
  }

  var url = SITE + "/catalogo?search=" + encodeURIComponent(q);

  return getPage(url, SITE + "/").then(function (html) {
    var results = [];
    var found = {};

    var regex =
      /<article[^>]*class="[^"]*group\/item[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*alt="[^"]*"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*text-lead[^"]*"[^>]*>([^<]+)<\/h3>[\s\S]*?<a[^>]+href="([^"]+)"/gi;

    var match;

    while ((match = regex.exec(html)) !== null) {
      var image = abs(match[1]);
      var title = clean(match[2]);
      var href = abs(match[3]);

      if (!href || !title || found[href]) {
        continue;
      }

      found[href] = true;

      results.push({
        id: href.replace(SITE, ""),
        title: title,
        url: href,
        cover: image,
        type: "anime",
        sourceId: SOURCE_ID
      });
    }

    return results;
  }).catch(function () {
    return [];
  });
}

/* INICIO */

function getHome(options) {
  return Promise.resolve([]);
}

/* DETALLE + EPISODIOS */

function getDetail(url, options) {
  var pageUrl = String(url || "");

  if (!/^https?:\/\//i.test(pageUrl)) {
    pageUrl = abs(pageUrl);
  }

  return getPage(pageUrl, SITE + "/").then(function (html) {

    var titleMatch = html.match(
      /<h1[^>]*>([^<]+)<\/h1>/i
    );

    var title = titleMatch
      ? clean(titleMatch[1])
      : "AnimeAV1";

    var descriptionMatch = html.match(
      /<div class="entry[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/i
    );

    var description = descriptionMatch
      ? clean(descriptionMatch[1])
      : "";

    var imageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

    var image = imageMatch
      ? abs(imageMatch[1])
      : "";

    var episodes = [];
    var foundEpisodes = {};

    var episodeRegex =
      /<a[^>]+href="([^"]+\/(\d+))"[^>]*>\s*<span class="sr-only">/gi;

    var match;

    while ((match = episodeRegex.exec(html)) !== null) {

      var episodeUrl = abs(match[1]);
      var number = parseInt(match[2], 10);

      if (!episodeUrl || isNaN(number) || foundEpisodes[episodeUrl]) {
        continue;
      }

      foundEpisodes[episodeUrl] = true;

      episodes.push({
        id: String(number),
        number: number,
        title: "Episode " + number,
        url: episodeUrl
      });
    }

    episodes.sort(function (a, b) {
      return a.number - b.number;
    });

    return {
      id: pageUrl.replace(SITE, ""),
      title: title,
      url: pageUrl,
      cover: image,
      description: description,
      status: "unknown",
      genres: [],
      studios: [],
      type: "anime",
      sourceId: SOURCE_ID,
      episodes: episodes,
      subCount: episodes.length,
      dubCount: 0
    };
  });
}

function getEpisodes(url, options) {
  return getDetail(url, options).then(function (detail) {
    return detail.episodes || [];
  });
}

/* VIDEO */

function getVideoSources(episodeUrl) {

  var pageUrl = String(episodeUrl || "");

  if (!/^https?:\/\//i.test(pageUrl)) {
    pageUrl = abs(pageUrl);
  }

  return getPage(pageUrl, SITE + "/").then(function (html) {

    /*
     * AnimeAV1:
     * la página del episodio contiene:
     *
     * url:"https://player.zilla-networks.com/play/..."
     *
     * El módulo original convierte /play/ en /m3u8/.
     */

    var match = html.match(
      /url\s*:\s*["'](https:\/\/player\.zilla-networks\.com\/play\/[^"']+)["']/i
    );

    if (!match) {
      throw new Error(
        "AnimeAV1: no se encontró el reproductor"
      );
    }

    var streamUrl = match[1].replace(
      "/play/",
      "/m3u8/"
    );

    return [{
      url: streamUrl,
      quality: "auto",
      container: "hls",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        "Referer": pageUrl,
        "Origin": SITE
      },
      kind: "sub",
      audioLang: "ja",
      subtitles: []
    }];
  });
}
