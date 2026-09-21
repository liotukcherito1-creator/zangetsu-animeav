// FlixLatam — Zangetsu Provider
// https://flixlatam.com/
//
// Adaptado desde el módulo Sora de FlixLatam.
// No incluye la resolución de embeds protegidos mediante PoW/AES/Altcha.

var SITE = 'https://flixlatam.com';
var SOURCE_ID = 'flixlatam';

var UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/137.0.0.0 Safari/537.36';


// ============================================================
// INFO
// ============================================================

function getInfo() {
  return {
    name: 'FlixLatam',
    lang: 'es',
    baseUrl: SITE,
    logo: SITE + '/themes/dooplay/assets/img/favicon.png',
    type: 'anime',
    version: '1.0.0'
  };
}


// ============================================================
// HTTP
// ============================================================

function fetchPage(url, referer) {
  return fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': referer || SITE + '/'
    }
  }).then(function (response) {
    return response.body || '';
  });
}


// ============================================================
// HELPERS
// ============================================================

function absoluteUrl(url) {
  if (!url) return '';

  url = String(url).trim();

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (/^\/\//.test(url)) {
    return 'https:' + url;
  }

  return SITE + (
    url.charAt(0) === '/'
      ? url
      : '/' + url
  );
}


function cleanText(text) {
  if (!text) return '';

  return String(text)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}


// ============================================================
// SEARCH
// ============================================================

function search(query, page, options) {

  var q = String(query || '').trim();

  if (!q) {
    return Promise.resolve([]);
  }

  var url =
    SITE +
    '/search?s=' +
    encodeURIComponent(q);

  return fetchPage(url, SITE + '/')
    .then(function (html) {

      var results = [];
      var seen = {};

      /*
       * Basado en el módulo original:
       *
       * <article class="item">
       *   <h3><a href="...">Título</a></h3>
       *   <img src="...">
       * </article>
       */

      var itemRe =
        /<article\s+class=["']item["'][^>]*>([\s\S]*?)<\/article>/gi;

      var match;

      while ((match = itemRe.exec(html)) !== null) {

        var block = match[1];

        var a =
          block.match(
            /<h3>\s*<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i
          );

        if (!a) {
          continue;
        }

        var href =
          absoluteUrl(a[1]);

        var title =
          cleanText(a[2]);

        if (!href || !title || seen[href]) {
          continue;
        }

        var img =
          block.match(
            /<img[^>]+src=["']([^"']+)["']/i
          );

        var image =
          img
            ? absoluteUrl(img[1])
            : '';

        seen[href] = true;

        results.push({
          id: href,
          title: title,
          url: href,
          cover: image,
          type: 'anime',
          sourceId: SOURCE_ID
        });
      }

      return results;

    })
    .catch(function () {
      return [];
    });
}


// ============================================================
// HOME
// ============================================================

function getHome(options) {

  return fetchPage(
    SITE + '/',
    SITE + '/'
  )
  .then(function (html) {

    var items = [];
    var seen = {};

    var itemRe =
      /<article\s+class=["']item["'][^>]*>([\s\S]*?)<\/article>/gi;

    var match;

    while ((match = itemRe.exec(html)) !== null) {

      var block = match[1];

      var a =
        block.match(
          /<h3>\s*<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i
        );

      if (!a) {
        continue;
      }

      var href =
        absoluteUrl(a[1]);

      var title =
        cleanText(a[2]);

      if (!href || !title || seen[href]) {
        continue;
      }

      var img =
        block.match(
          /<img[^>]+src=["']([^"']+)["']/i
        );

      var image =
        img
          ? absoluteUrl(img[1])
          : '';

      seen[href] = true;

      items.push({
        id: href,
        title: title,
        url: href,
        cover: image,
        type: 'anime',
        sourceId: SOURCE_ID
      });

      if (items.length >= 30) {
        break;
      }
    }

    if (!items.length) {
      return [];
    }

    return [
      {
        title: 'FlixLatam',
        items: items
      }
    ];

  })
  .catch(function () {
    return [];
  });
}


// ============================================================
// DETAIL
// ============================================================

function getDetail(url, options) {

  var pageUrl = absoluteUrl(url);

  return fetchPage(
    pageUrl,
    SITE + '/'
  )
  .then(function (html) {

    var title = '';

    var h1 =
      html.match(
        /<h1[^>]*>([\s\S]*?)<\/h1>/i
      );

    if (h1) {
      title = cleanText(h1[1]);
    }

    if (!title) {

      var titleTag =
        html.match(
          /<title[^>]*>([\s\S]*?)<\/title>/i
        );

      if (titleTag) {
        title = cleanText(titleTag[1]);
      }
    }


    var image = '';

    var ogImage =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      );

    if (ogImage) {
      image = absoluteUrl(ogImage[1]);
    }


    var description = '';

    var descriptionMeta =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      );

    if (descriptionMeta) {
      description =
        cleanText(descriptionMeta[1]);
    }


    /*
     * Intentamos JSON-LD, igual que el módulo original.
     */

    var ld =
      html.match(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      );

    if (ld) {

      for (var i = 0; i < ld.length; i++) {

        try {

          var raw =
            ld[i]
              .replace(/<script[^>]*>/i, '')
              .replace(/<\/script>\s*$/i, '');

          var data =
            JSON.parse(raw);

          if (data) {

            if (!description && data.description) {
              description =
                cleanText(data.description);
            }

            if (!image && data.image) {

              if (typeof data.image === 'string') {
                image =
                  absoluteUrl(data.image);
              }
            }

            if (!title && data.name) {
              title =
                cleanText(data.name);
            }
          }

        } catch (e) {
          // JSON-LD inválido: continuar
        }
      }
    }


    return getEpisodes(pageUrl)
      .then(function (episodes) {

        return {
          id: pageUrl,
          title: title || pageUrl,
          url: pageUrl,
          cover: image || null,
          description: description,
          type: 'anime',
          sourceId: SOURCE_ID,
          episodes: episodes,
          subCount: episodes.length,
          dubCount: 0
        };

      });

  })
  .catch(function () {

    return {
      id: pageUrl,
      title: pageUrl,
      url: pageUrl,
      cover: null,
      description: '',
      type: 'anime',
      sourceId: SOURCE_ID,
      episodes: []
    };

  });
}


// ============================================================
// EPISODES
// ============================================================

function getEpisodes(url, options) {

  var pageUrl = absoluteUrl(url);

  return fetchPage(
    pageUrl,
    SITE + '/'
  )
  .then(function (html) {

    var episodes = [];
    var seen = {};

    /*
     * Formato observado en el módulo original:
     *
     * /serie/<slug>/temporada/<season>/capitulo/<episode>
     * /anime/<slug>/temporada/<season>/capitulo/<episode>
     */

    var epRe =
      /href=["'](\/(?:serie|anime)\/[^"']*\/temporada\/(\d+)\/capitulo\/(\d+))["']/gi;

    var match;

    while ((match = epRe.exec(html)) !== null) {

      var href =
        absoluteUrl(match[1]);

      var season =
        parseInt(match[2], 10);

      var number =
        parseInt(match[3], 10);

      if (!href || !number || seen[href]) {
        continue;
      }

      seen[href] = true;

      episodes.push({
        id: href,
        number: number,
        title:
          'Temporada ' +
          season +
          ' - Episodio ' +
          number,
        url: href,
        season: season
      });
    }


    episodes.sort(function (a, b) {

      if (a.season !== b.season) {
        return a.season - b.season;
      }

      return a.number - b.number;
    });


    return episodes;

  })
  .catch(function () {
    return [];
  });
}


// ============================================================
// VIDEO SOURCES
// ============================================================

function getVideoSources(episodeUrl, options) {

  var url =
    absoluteUrl(episodeUrl);

  return fetchPage(
    url,
    SITE + '/'
  )
  .then(function (html) {

    var sources = [];

    /*
     * Fuente HLS directamente expuesta en la página.
     *
     * NO intentamos descifrar ni superar el sistema protegido
     * de los embeds vidurl.
     */

    var matches = [];

    var regex =
      /https?:\/\/[^"'\\\s<>]+\.m3u8(?:\?[^"'\\\s<>]*)?/gi;

    var match;

    while ((match = regex.exec(html)) !== null) {

      var stream =
        match[0];

      if (matches.indexOf(stream) !== -1) {
        continue;
      }

      matches.push(stream);

      sources.push({
        url: stream,
        quality: '1080p',
        container: 'hls',
        headers: {
          'User-Agent': UA,
          'Referer': url
        },
        kind: 'sub',
        audioLang: 'es',
        subtitles: []
      });
    }


    /*
     * Algunos reproductores usan src="...m3u8".
     */

    var srcRegex =
      /(?:src|file|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi;

    while ((match = srcRegex.exec(html)) !== null) {

      var stream2 =
        match[1];

      if (matches.indexOf(stream2) !== -1) {
        continue;
      }

      matches.push(stream2);

      sources.push({
        url: stream2,
        quality: '1080p',
        container: 'hls',
        headers: {
          'User-Agent': UA,
          'Referer': url
        },
        kind: 'sub',
        audioLang: 'es',
        subtitles: []
      });
    }


    return sources;

  })
  .catch(function () {
    return [];
  });
}


// Compatibilidad
function getVideoSource(url, options) {
  return getVideoSources(url, options);
}
