// AnimeAV1 — Zangetsu Provider
// https://animeav1.com/
//
// Flujo:
//   /catalogo?search=       -> búsqueda
//   /media/<slug>           -> información + episodios
//   /media/<slug>/<ep>      -> reproductor
//   player.zilla-networks.com/play/... -> /m3u8/...
//
// Fuente del funcionamiento:
// AnimeAV1 + módulo Sora que compartiste como referencia.
// Este archivo está adaptado al formato de providers de Zangetsu.

var SOURCE_ID = (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
  ? String(__SOURCE_ID)
  : 'animeav1';

var SITE = 'https://animeav1.com';

var UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36';


// ─────────────────────────────────────────────
// INFO
// ─────────────────────────────────────────────

function getInfo() {
  return {
    name: 'AnimeAV1',
    lang: 'es',
    baseUrl: SITE,
    logo: SITE + '/favicon.png',
    type: 'anime',
    version: '1.0.1'
  };
}


// ─────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────

function request(url, referer) {
  return fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': referer || SITE + '/'
    }
  }).then(function (response) {
    return response.body || '';
  });
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function absUrl(url) {
  if (!url) return null;

  url = String(url).trim();

  if (url.indexOf('//') === 0) {
    return 'https:' + url;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.charAt(0) === '/') {
    return SITE + url;
  }

  return SITE + '/' + url;
}


function cleanText(text) {
  if (!text) return '';

  return String(text)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}


function decodeEntities(text) {
  return cleanText(text);
}


function extractTitle(html) {
  var match;

  match = html.match(
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  );

  if (match) {
    return cleanText(match[1]);
  }

  match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (match) {
    return cleanText(match[1])
      .replace(/\s*[-|]\s*AnimeAV1.*$/i, '')
      .trim();
  }

  return 'Anime';
}


function extractImage(html) {
  var match;

  match = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );

  if (match) {
    return absUrl(match[1]);
  }

  match = html.match(
    /<img[^>]+src=["']([^"']+)["']/i
  );

  if (match) {
    return absUrl(match[1]);
  }

  return null;
}


// ─────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────

function search(query, page, options) {

  var q = String(query || '').trim();

  if (!q) {
    return Promise.resolve([]);
  }

  var url =
    SITE +
    '/catalogo?search=' +
    encodeURIComponent(q);

  return request(url, SITE + '/')
    .then(function (html) {

      var results = [];
      var seen = {};

      /*
       * AnimeAV1 usa tarjetas similares a:
       *
       * <article class="group/item">
       *   <img src="...">
       *   <h3 class="...text-lead...">Naruto</h3>
       *   <a href="/media/naruto">
       */

      var regex =
        /<article[^>]*class=["'][^"']*group\/item[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;

      var match;

      while ((match = regex.exec(html)) !== null) {

        var card = match[0];

        var hrefMatch =
          card.match(
            /<a[^>]+href=["']([^"']+)["']/i
          );

        if (!hrefMatch) {
          continue;
        }

        var href = absUrl(hrefMatch[1]);

        if (!href || seen[href]) {
          continue;
        }

        /*
         * Primero buscamos la imagen.
         */
        var imageMatch =
          card.match(
            /<img[^>]+src=["']([^"']+)["']/i
          );

        if (!imageMatch) {
          imageMatch =
            card.match(
              /<img[^>]+data-src=["']([^"']+)["']/i
            );
        }

        var image =
          imageMatch
            ? absUrl(imageMatch[1])
            : null;

        /*
         * Título.
         */
        var titleMatch =
          card.match(
            /<h3[^>]*class=["'][^"']*text-lead[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i
          );

        if (!titleMatch) {
          titleMatch =
            card.match(
              /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i
            );
        }

        if (!titleMatch) {
          continue;
        }

        var title =
          decodeEntities(titleMatch[1]);

        if (!title) {
          continue;
        }

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


// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────

function getHome(options) {

  return request(
    SITE + '/catalogo',
    SITE + '/'
  )
    .then(function (html) {

      var rows = [];

      /*
       * AnimeAV1 puede cambiar el HTML de la página.
       * Por eso buscamos tarjetas de forma genérica.
       */

      var regex =
        /<article[^>]*class=["'][^"']*group\/item[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;

      var match;
      var items = [];
      var seen = {};

      while ((match = regex.exec(html)) !== null) {

        var card = match[0];

        var hrefMatch =
          card.match(
            /<a[^>]+href=["']([^"']+)["']/i
          );

        if (!hrefMatch) {
          continue;
        }

        var href = absUrl(hrefMatch[1]);

        if (!href || seen[href]) {
          continue;
        }

        var titleMatch =
          card.match(
            /<h3[^>]*>([\s\S]*?)<\/h3>/i
          );

        if (!titleMatch) {
          continue;
        }

        var title =
          decodeEntities(titleMatch[1]);

        if (!title) {
          continue;
        }

        var imageMatch =
          card.match(
            /<img[^>]+src=["']([^"']+)["']/i
          );

        if (!imageMatch) {
          imageMatch =
            card.match(
              /<img[^>]+data-src=["']([^"']+)["']/i
            );
        }

        var image =
          imageMatch
            ? absUrl(imageMatch[1])
            : null;

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

      if (items.length) {
        rows.push({
          title: 'AnimeAV1',
          items: items
        });
      }

      return rows;

    })
    .catch(function () {
      return [];
    });
}


// ─────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────

function getDetail(url, options) {

  var pageUrl = String(url);

  return request(
    pageUrl,
    SITE + '/'
  )
    .then(function (html) {

      var title =
        extractTitle(html);

      var cover =
        extractImage(html);

      /*
       * Descripción.
       *
       * AnimeAV1 utiliza un bloque entry.
       */
      var description = '';

      var descriptionMatch =
        html.match(
          /<div[^>]*class=["'][^"']*entry[^"']*["'][^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i
        );

      if (descriptionMatch) {
        description =
          cleanText(descriptionMatch[1]);
      }

      if (!description) {

        descriptionMatch =
          html.match(
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
          );

        if (descriptionMatch) {
          description =
            cleanText(descriptionMatch[1]);
        }
      }


      /*
       * Géneros.
       */
      var genres = [];

      var genreRegex =
        /href=["'][^"']*\/genero\/[^"']+["'][^>]*>([^<]+)</gi;

      var genreMatch;

      while (
        (genreMatch = genreRegex.exec(html)) !== null &&
        genres.length < 10
      ) {

        var genre =
          cleanText(genreMatch[1]);

        if (
          genre &&
          genres.indexOf(genre) === -1
        ) {
          genres.push(genre);
        }
      }


      return {
        id: pageUrl,
        title: title,
        url: pageUrl,
        cover: cover,
        description: description,
        genres: genres,
        type: 'anime',
        sourceId: SOURCE_ID,
        episodes: []
      };

    });

}


// ─────────────────────────────────────────────
// EPISODES
// ─────────────────────────────────────────────

function getEpisodes(url, options) {

  var pageUrl = String(url);

  return request(
    pageUrl,
    SITE + '/'
  )
    .then(function (html) {

      var episodes = [];
      var seen = {};

      /*
       * El módulo que encontraste para AnimeAV1
       * encontró episodios con:
       *
       * <a href=".../1">
       *   <span class="sr-only">
       *
       * Por eso buscamos ese patrón.
       */

      var regex =
        /<a[^>]+href=["']([^"']+\/(\d+))["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*sr-only[^"']*["'][^>]*>/gi;

      var match;

      while ((match = regex.exec(html)) !== null) {

        var href =
          absUrl(match[1]);

        var number =
          parseInt(match[2], 10);

        if (!href || isNaN(number)) {
          continue;
        }

        if (seen[href]) {
          continue;
        }

        seen[href] = true;

        episodes.push({
          id: href,
          number: number,
          title: 'Episode ' + number,
          url: href
        });
      }


      /*
       * Si el HTML cambió ligeramente,
       * hacemos un segundo intento.
       */

      if (!episodes.length) {

        var fallback =
          /<a[^>]+href=["']([^"']+\/(\d+))["'][^>]*>/gi;

        while ((match = fallback.exec(html)) !== null) {

          var href2 =
            absUrl(match[1]);

          var number2 =
            parseInt(match[2], 10);

          if (!href2 || isNaN(number2)) {
            continue;
          }

          if (seen[href2]) {
            continue;
          }

          seen[href2] = true;

          episodes.push({
            id: href2,
            number: number2,
            title: 'Episode ' + number2,
            url: href2
          });
        }
      }


      /*
       * Orden numérico.
       */
      episodes.sort(function (a, b) {
        return a.number - b.number;
      });

      return episodes;

    })
    .catch(function () {
      return [];
    });
}


// ─────────────────────────────────────────────
// DETAIL + EPISODES
// ─────────────────────────────────────────────

function getDetailWithEpisodes(url, options) {

  return getDetail(url, options)
    .then(function (detail) {

      return getEpisodes(url, options)
        .then(function (episodes) {

          detail.episodes = episodes;

          detail.subCount =
            episodes.length;

          detail.dubCount = 0;

          return detail;
        });

    });

}


// ─────────────────────────────────────────────
// VIDEO SOURCE
// ─────────────────────────────────────────────

function getVideoSources(episodeUrl) {

  return extractStreamUrl(
    String(episodeUrl)
  );

}


// ─────────────────────────────────────────────
// EXTRACT STREAM
// ─────────────────────────────────────────────

function extractStreamUrl(url) {

  return request(
    url,
    SITE + '/'
  )
    .then(function (html) {

      /*
       * AnimeAV1:
       *
       * url:"https://player.zilla-networks.com/play/..."
       *
       * El módulo Sora que encontraste hacía:
       *
       * /play/  -> /m3u8/
       */

      var match =
        html.match(
          /url\s*:\s*["'](https:\/\/player\.zilla-networks\.com\/play\/[^"']+)["']/i
        );

      if (!match) {

        /*
         * Segundo formato posible:
         *
         * url = "..."
         */
        match =
          html.match(
            /url\s*=\s*["'](https:\/\/player\.zilla-networks\.com\/play\/[^"']+)["']/i
          );
      }

      if (!match) {

        /*
         * Último intento:
         * buscar directamente cualquier URL Zilla.
         */
        match =
          html.match(
            /(https:\/\/player\.zilla-networks\.com\/play\/[^"'\\]+)/i
          );
      }

      if (!match) {
        throw new Error(
          'AnimeAV1: no se encontró el player Zilla'
        );
      }

      var playerUrl =
        match[1];

      var streamUrl =
        playerUrl.replace(
          '/play/',
          '/m3u8/'
        );


      return [
        {
          url: streamUrl,
          quality: '1080p',
          container: 'hls',
          headers: {
            'User-Agent': UA,
            'Referer': SITE + '/'
          },
          kind: 'sub',
          audioLang: 'ja',
          subtitles: []
        }
      ];

    });

}


// ─────────────────────────────────────────────
// ALIAS PARA COMPATIBILIDAD
// ─────────────────────────────────────────────

function getVideoSource(url, options) {
  return getVideoSources(url, options);
}
