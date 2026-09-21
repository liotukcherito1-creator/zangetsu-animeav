// AnimeAV1 — Zangetsu provider
// https://animeav1.com/
//
// Search:
//   /catalogo?search=<query>
//
// Detail:
//   /media/<slug>
//
// Episodes:
//   Links contained in the anime detail page.
//
// Stream:
//   Episode page -> player.zilla-networks.com/play/... -> /m3u8/...

var SOURCE_ID = (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
  ? String(__SOURCE_ID)
  : 'animeav1';

var SITE = 'https://animeav1.com';

var UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36';


// ============================================================
// INFO
// ============================================================

function getInfo() {
  return {
    name: 'AnimeAV1',
    lang: 'es',
    baseUrl: SITE,
    logo: SITE + '/favicon.png',
    type: 'anime',
    version: '1.0.2'
  };
}


// ============================================================
// HTTP
// ============================================================

function _get(url, ref) {
  var headers = {
    'User-Agent': UA,
    'Referer': ref || SITE + '/'
  };

  return fetch(url, {
    headers: headers
  }).then(function (r) {
    return r.body || '';
  });
}


// ============================================================
// SEARCH
// ============================================================

function search(query, page, opts) {

  var q = String(query || '').trim();

  if (!q) {
    return Promise.resolve([]);
  }

  var url =
    SITE +
    '/catalogo?search=' +
    encodeURIComponent(q);

  return _get(url, SITE + '/').then(function (html) {

    var results = [];
    var seen = {};

    /*
     * AnimeAV1 uses cards similar to:
     *
     * <article class="group/item ...">
     *   <img ...>
     *   <h3 class="... text-lead ...">
     *   ...
     *   <a href="/media/...">
     */

    var regex =
      /<article[^>]*class="[^"]*group\/item[^"]*"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*text-lead[^"]*"[^>]*>([^<]+)<\/h3>[\s\S]*?<a[^>]+href="([^"]+)"/gi;

    var match;

    while ((match = regex.exec(html)) !== null) {

      var image = match[1] || '';
      var title = match[2] || '';
      var href = match[3] || '';

      title = htmlText(title).trim();

      if (!href || !title) {
        continue;
      }

      if (seen[href]) {
        continue;
      }

      seen[href] = true;

      if (href.indexOf('http') !== 0) {
        href = SITE + (
          href.charAt(0) === '/'
            ? href
            : '/' + href
        );
      }

      if (image && image.indexOf('http') !== 0) {
        image = SITE + (
          image.charAt(0) === '/'
            ? image
            : '/' + image
        );
      }

      results.push({
        id: href.replace(SITE + '/', ''),
        title: title,
        url: href,
        cover: image || null,
        type: 'anime',
        sourceId: SOURCE_ID
      });
    }

    return results;

  }).catch(function () {
    return [];
  });
}


// ============================================================
// HELPERS
// ============================================================

function _absoluteUrl(url) {

  if (!url) {
    return null;
  }

  url = String(url).trim();

  if (url.indexOf('http://') === 0 ||
      url.indexOf('https://') === 0) {
    return url;
  }

  if (url.indexOf('//') === 0) {
    return 'https:' + url;
  }

  return SITE + (
    url.charAt(0) === '/'
      ? url
      : '/' + url
  );
}


function _episodeNumber(url, text) {

  var value = String(text || '');

  var m =
    value.match(/episode\s*(\d+)/i) ||
    value.match(/episodio\s*(\d+)/i) ||
    value.match(/cap[ií]tulo\s*(\d+)/i);

  if (m) {
    return parseInt(m[1], 10);
  }

  m = String(url || '').match(/\/(\d+)(?:\/)?(?:[#?].*)?$/);

  if (m) {
    return parseInt(m[1], 10);
  }

  return 0;
}


// ============================================================
// HOME
// ============================================================

function getHome(opts) {

  return _get(SITE + '/', SITE + '/')
    .then(function (html) {

      var items = [];
      var seen = {};

      var regex =
        /<a[^>]+href="([^"]*\/media\/[^"]+)"[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)="([^"]+)"[^>]*>[\s\S]*?(?:<h[2-6][^>]*>|<span[^>]*>)([^<]+)</gi;

      var match;

      while ((match = regex.exec(html)) !== null) {

        var href = _absoluteUrl(match[1]);
        var image = _absoluteUrl(match[2]);
        var title = htmlText(match[3] || '').trim();

        if (!href || !title || seen[href]) {
          continue;
        }

        seen[href] = true;

        items.push({
          id: href.replace(SITE + '/', ''),
          title: title,
          url: href,
          cover: image,
          type: 'anime',
          sourceId: SOURCE_ID
        });
      }

      if (!items.length) {
        return [];
      }

      return [
        {
          title: 'AnimeAV1',
          items: items.slice(0, 24)
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

function getDetail(url, opts) {

  var pageUrl = String(url || '');

  if (pageUrl.indexOf('http') !== 0) {
    pageUrl = SITE + (
      pageUrl.charAt(0) === '/'
        ? pageUrl
        : '/' + pageUrl
    );
  }

  return _get(pageUrl, SITE + '/')
    .then(function (html) {

      var title =
        (html.match(
          /<h1[^>]*>([\s\S]*?)<\/h1>/i
        ) || [])[1] || '';

      title = htmlText(title).trim();

      if (!title) {
        title =
          (html.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i
          ) || [])[1] || '';

        title = htmlText(title)
          .replace(/\s*\|.*$/i, '')
          .trim();
      }

      var image =
        (html.match(
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
        ) || [])[1] || null;

      if (!image) {
        image =
          (html.match(
            /<img[^>]+(?:src|data-src)=["']([^"']+)["']/i
          ) || [])[1] || null;
      }

      image = _absoluteUrl(image);

      var description = '';

      var descMatch =
        html.match(
          /<div[^>]*class=["'][^"']*entry[^"']*["'][^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i
        );

      if (!descMatch) {
        descMatch =
          html.match(
            /<div[^>]*class=["'][^"']*(?:description|synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
          );
      }

      if (descMatch) {
        description = htmlText(descMatch[1]).trim();
      }

      return _extractEpisodes(
        html,
        pageUrl,
        title,
        image,
        description
      );

    })
    .catch(function () {

      return {
        id: pageUrl,
        title: pageUrl,
        url: pageUrl,
        cover: null,
        description: '',
        episodes: [],
        type: 'anime',
        sourceId: SOURCE_ID
      };

    });
}


// ============================================================
// EPISODES
// ============================================================

function _extractEpisodes(
  html,
  pageUrl,
  title,
  image,
  description
) {

  var episodes = [];
  var seen = {};

  /*
   * AnimeAV1 episode links normally contain:
   *
   * /media/<anime>/.../<episode>
   *
   * We intentionally collect only links that appear to point
   * to episode pages.
   */

  var regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*sr-only[^"']*["'][^>]*>/gi;

  var match;

  while ((match = regex.exec(html)) !== null) {

    var href = _absoluteUrl(match[1]);

    if (!href || seen[href]) {
      continue;
    }

    /*
     * Avoid grabbing the current anime page itself.
     */
    if (href === pageUrl) {
      continue;
    }

    var number = _episodeNumber(href, '');

    if (!number || number < 1) {
      continue;
    }

    seen[href] = true;

    episodes.push({
      id: 'episode-' + number,
      number: number,
      title: 'Episode ' + number,
      url: href
    });
  }


  /*
   * Fallback parser:
   * collect links containing an episode number even when
   * the sr-only span changes in the website HTML.
   */

  if (!episodes.length) {

    var linkRegex =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    while ((match = linkRegex.exec(html)) !== null) {

      var href2 = _absoluteUrl(match[1]);
      var text = htmlText(match[2] || '').trim();

      if (!href2 || seen[href2]) {
        continue;
      }

      if (
        !/episode|episodio|cap[ií]tulo/i.test(text) &&
        !/\/\d+(?:\/)?(?:[#?].*)?$/.test(href2)
      ) {
        continue;
      }

      var number2 = _episodeNumber(href2, text);

      if (!number2 || number2 < 1) {
        continue;
      }

      seen[href2] = true;

      episodes.push({
        id: 'episode-' + number2,
        number: number2,
        title: text || ('Episode ' + number2),
        url: href2
      });
    }
  }


  episodes.sort(function (a, b) {
    return a.number - b.number;
  });


  return {
    id: pageUrl,
    title: title || pageUrl,
    url: pageUrl,
    cover: image,
    description: description || '',
    status: 'unknown',
    genres: [],
    studios: [],
    type: 'anime',
    sourceId: SOURCE_ID,
    episodes: episodes,
    subCount: episodes.length,
    dubCount: 0
  };
}


// ============================================================
// getEpisodes
// ============================================================

function getEpisodes(url, opts) {

  return getDetail(url, opts)
    .then(function (detail) {
      return detail.episodes || [];
    });
}


// ============================================================
// STREAM EXTRACTION
// ============================================================

function extractStreamUrl(url) {

  var episodeUrl = String(url || '');

  return _get(
    episodeUrl,
    SITE + '/'
  )
  .then(function (html) {

    var playerUrl = null;
    var match;


    // --------------------------------------------------------
    // FORMATO PRINCIPAL
    // url:"https://player.zilla-networks.com/play/..."
    // --------------------------------------------------------

    match = html.match(
      /url\s*:\s*["'](https:\/\/player\.zilla-networks\.com\/play\/[^"']+)["']/i
    );

    if (match) {
      playerUrl = match[1];
    }


    // --------------------------------------------------------
    // player-url
    // --------------------------------------------------------

    if (!playerUrl) {

      match = html.match(
        /player-url\s*["']?\s*[:=]\s*["'](https:\/\/player\.zilla-networks\.com\/play\/[^"']+)["']/i
      );

      if (match) {
        playerUrl = match[1];
      }
    }


    // --------------------------------------------------------
    // Cualquier aparición del player Zilla
    // --------------------------------------------------------

    if (!playerUrl) {

      match = html.match(
        /["'](https:\/\/player\.zilla-networks\.com\/play\/[^"']+)["']/i
      );

      if (match) {
        playerUrl = match[1];
      }
    }


    // --------------------------------------------------------
    // Si AnimeAV1 ya entrega directamente un m3u8
    // --------------------------------------------------------

    if (!playerUrl) {

      match = html.match(
        /(https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*)/i
      );

      if (match) {

        return [
          {
            url: match[1],
            quality: '1080p',
            container: 'hls',
            headers: {
              'User-Agent': UA,
              'Referer': episodeUrl
            },
            kind: 'sub',
            audioLang: 'ja',
            subtitles: []
          }
        ];
      }
    }


    // --------------------------------------------------------
    // No encontramos reproductor
    // --------------------------------------------------------

    if (!playerUrl) {

      throw new Error(
        'AnimeAV1: no se encontró el reproductor Zilla'
      );
    }


    // --------------------------------------------------------
    // Zilla:
    //
    // /play/XXXXX
    //
    // pasa a:
    //
    // /m3u8/XXXXX
    // --------------------------------------------------------

    var streamUrl = playerUrl.replace(
      '/play/',
      '/m3u8/'
    );


    // --------------------------------------------------------
    // Devolver HLS a Zangetsu
    // --------------------------------------------------------

    return [
      {
        url: streamUrl,

        quality: '1080p',

        container: 'hls',

        headers: {
          'User-Agent': UA,

          /*
           * El servidor Zilla puede comprobar el Referer.
           */
          'Referer': playerUrl,

          'Origin': 'https://player.zilla-networks.com'
        },

        kind: 'sub',

        audioLang: 'ja',

        subtitles: []
      }
    ];

  });
}


// ============================================================
// ZANGETSU STREAM FUNCTION
// ============================================================

function getVideoSources(episodeUrl) {

  return extractStreamUrl(
    episodeUrl
  );
}
