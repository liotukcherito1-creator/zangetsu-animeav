// ============================================================
// FlixLatam — Zangetsu Provider
// https://flixlatam.com/
//
// Adaptado desde el módulo Sora de FlixLatam.
//
// Funciones:
//   - Catálogo
//   - Búsqueda
//   - Detalles
//   - Episodios
//   - Extracción de HLS directamente expuesto
//
// ============================================================

var SOURCE_ID =
  (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
    ? String(__SOURCE_ID)
    : 'flixlatam';

var SITE = 'https://flixlatam.com';

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


// ============================================================
// HELPERS
// ============================================================

function absUrl(url) {

  if (!url) {
    return null;
  }

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

  if (!text) {
    return '';
  }

  return String(text)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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
      .replace(/\s*[-|]\s*FlixLatam.*$/i, '')
      .trim();
  }

  return 'FlixLatam';
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
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
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


// ============================================================
// CARD PARSER
// ============================================================

function parseCards(html) {

  var results = [];
  var seen = {};

  /*
   * FlixLatam:
   *
   * <article class="item">
   *   ...
   *   <h3>
   *      <a href="...">Título</a>
   *   </h3>
   *   <img src="...">
   * </article>
   */

  var itemRe =
    /<article\s+class=["']item["'][^>]*>([\s\S]*?)<\/article>/gi;

  var match;

  while ((match = itemRe.exec(html)) !== null) {

    var block = match[1];

    var link =
      block.match(
        /<h3>\s*<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i
      );

    /*
     * Fallback por si cambia ligeramente el HTML.
     */

    if (!link) {

      link =
        block.match(
          /<a\s+href=["']([^"']+)["'][^>]*>[\s\S]*?<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>[\s\S]*?<\/a>/i
        );
    }

    if (!link) {
      continue;
    }

    var href =
      absUrl(link[1]);

    var title =
      decodeEntities(link[2]);

    if (!href || !title || seen[href]) {
      continue;
    }


    var imageMatch =
      block.match(
        /<img[^>]+src=["']([^"']+)["']/i
      );

    if (!imageMatch) {

      imageMatch =
        block.match(
          /<img[^>]+data-src=["']([^"']+)["']/i
        );
    }

    if (!imageMatch) {

      imageMatch =
        block.match(
          /<img[^>]+data-lazy-src=["']([^"']+)["']/i
        );
    }

    var image =
      imageMatch
        ? absUrl(imageMatch[1])
        : null;


    seen[href] = true;

    results.push({
      id: href,
      title: title,
      url: href,
      cover: image,
      type: 'anime',
      sourceId: SOURCE_ID
    });


    if (results.length >= 50) {
      break;
    }
  }

  return results;
}


// ============================================================
// SEARCH
// ============================================================

function search(query, page, options) {

  var q =
    String(query || '').trim();

  if (!q) {
    return Promise.resolve([]);
  }

  var url =
    SITE +
    '/search?s=' +
    encodeURIComponent(q);

  return request(url, SITE + '/')
    .then(function (html) {

      return parseCards(html);

    })
    .catch(function () {

      return [];

    });
}


// ============================================================
// HOME / CATALOG
// ============================================================

function getHome(options) {

  /*
   * El módulo Sora no proporciona una portada
   * independiente de FlixLatam.
   *
   * Para Zangetsu generamos el catálogo usando
   * búsquedas públicas.
   */

  var queries = [
    'a',
    'e',
    'i',
    'o',
    'u'
  ];


  function load(query) {

    var url =
      SITE +
      '/search?s=' +
      encodeURIComponent(query);

    return request(url, SITE + '/')
      .then(function (html) {

        return parseCards(html);

      })
      .catch(function () {

        return [];

      });
  }


  return Promise.all(
    queries.map(function (query) {
      return load(query);
    })
  )
  .then(function (groups) {

    var items = [];
    var seen = {};

    for (var i = 0; i < groups.length; i++) {

      var group =
        groups[i];

      for (var j = 0; j < group.length; j++) {

        var item =
          group[j];

        if (!item || !item.url) {
          continue;
        }

        if (seen[item.url]) {
          continue;
        }

        seen[item.url] = true;

        items.push(item);

        if (items.length >= 50) {
          break;
        }
      }

      if (items.length >= 50) {
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

  var pageUrl =
    absUrl(url);

  return request(
    pageUrl,
    SITE + '/'
  )
    .then(function (html) {

      var title =
        extractTitle(html);

      var cover =
        extractImage(html);


      // --------------------------------------------------------
      // DESCRIPTION
      // --------------------------------------------------------

      var description = '';

      var match =
        html.match(
          /<div[^>]*class=["'][^"']*entry[^"']*["'][^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i
        );

      if (match) {

        description =
          cleanText(match[1]);
      }


      if (!description) {

        match =
          html.match(
            /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
          );

        if (match) {

          description =
            cleanText(match[1]);
        }
      }


      // --------------------------------------------------------
      // GENRES
      // --------------------------------------------------------

      var genres = [];
      var genreSeen = {};

      var genreRe =
        /href=["'][^"']*\/genero\/[^"']+["'][^>]*>([^<]+)</gi;

      var genreMatch;

      while (
        (genreMatch = genreRe.exec(html)) !== null
      ) {

        var genre =
          cleanText(genreMatch[1]);

        if (
          genre &&
          !genreSeen[genre]
        ) {

          genreSeen[genre] = true;

          genres.push(genre);
        }
      }


      // --------------------------------------------------------
      // EPISODES
      // --------------------------------------------------------

      return getEpisodes(pageUrl)
        .then(function (episodes) {

          return {

            id: pageUrl,

            title:
              title || 'FlixLatam',

            url: pageUrl,

            cover:
              cover,

            description:
              description,

            genres:
              genres,

            type:
              'anime',

            sourceId:
              SOURCE_ID,

            episodes:
              episodes,

            subCount:
              episodes.length,

            dubCount:
              0

          };

        });

    })
    .catch(function () {

      return {

        id: pageUrl,

        title:
          pageUrl,

        url:
          pageUrl,

        cover:
          null,

        description:
          '',

        genres:
          [],

        type:
          'anime',

        sourceId:
          SOURCE_ID,

        episodes:
          []

      };

    });
}


// ============================================================
// EPISODES
// ============================================================

function getEpisodes(url, options) {

  var pageUrl =
    absUrl(url);

  return request(
    pageUrl,
    SITE + '/'
  )
    .then(function (html) {

      var episodes = [];
      var seen = {};

      /*
       * Intentamos primero URLs de episodios
       * con temporada/capítulo.
       */

      var patterns = [

        /href=["']([^"']*\/temporada\/(\d+)\/capitulo\/(\d+)[^"']*)["']/gi,

        /href=["']([^"']*\/episodio[s]?\/(\d+)[^"']*)["']/gi,

        /href=["']([^"']*\/capitulo\/(\d+)[^"']*)["']/gi

      ];


      // --------------------------------------------------------
      // TEMPORADA / CAPÍTULO
      // --------------------------------------------------------

      var match =
        patterns[0].exec(html);

      while (match !== null) {

        var href =
          absUrl(match[1]);

        var season =
          parseInt(match[2], 10);

        var number =
          parseInt(match[3], 10);


        if (
          href &&
          number &&
          !seen[href]
        ) {

          seen[href] = true;

          episodes.push({

            id:
              href,

            number:
              number,

            title:
              'Episodio ' + number,

            url:
              href,

            season:
              season || 1

          });
        }


        match =
          patterns[0].exec(html);
      }


      // --------------------------------------------------------
      // FALLBACK: /episodio/
      // --------------------------------------------------------

      match =
        patterns[1].exec(html);

      while (match !== null) {

        var href2 =
          absUrl(match[1]);

        var number2 =
          parseInt(match[2], 10);


        if (
          href2 &&
          number2 &&
          !seen[href2]
        ) {

          seen[href2] = true;

          episodes.push({

            id:
              href2,

            number:
              number2,

            title:
              'Episodio ' + number2,

            url:
              href2,

            season:
              1

          });
        }


        match =
          patterns[1].exec(html);
      }


      // --------------------------------------------------------
      // FALLBACK: /capitulo/
      // --------------------------------------------------------

      match =
        patterns[2].exec(html);

      while (match !== null) {

        var href3 =
          absUrl(match[1]);

        var number3 =
          parseInt(match[2], 10);


        if (
          href3 &&
          number3 &&
          !seen[href3]
        ) {

          seen[href3] = true;

          episodes.push({

            id:
              href3,

            number:
              number3,

            title:
              'Episodio ' + number3,

            url:
              href3,

            season:
              1

          });
        }


        match =
          patterns[2].exec(html);
      }


      // --------------------------------------------------------
      // ORDEN
      // --------------------------------------------------------

      episodes.sort(function (a, b) {

        if (
          (a.season || 1) !==
          (b.season || 1)
        ) {

          return (
            (a.season || 1) -
            (b.season || 1)
          );
        }

        return (
          (a.number || 0) -
          (b.number || 0)
        );

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
    absUrl(episodeUrl);

  return request(
    url,
    SITE + '/'
  )
    .then(function (html) {

      var sources = [];
      var seen = {};


      // --------------------------------------------------------
      // .M3U8 DIRECTO
      // --------------------------------------------------------

      var m3u8Re =
        /https?:\/\/[^"'\\\s<>]+\.m3u8(?:\?[^"'\\\s<>]*)?/gi;

      var match;

      while (
        (match = m3u8Re.exec(html)) !== null
      ) {

        var stream =
          match[0];

        if (seen[stream]) {
          continue;
        }

        seen[stream] = true;

        sources.push({

          url:
            stream,

          quality:
            '1080p',

          container:
            'hls',

          headers: {

            'User-Agent':
              UA,

            'Referer':
              url

          },

          kind:
            'sub',

          audioLang:
            'es',

          subtitles:
            []

        });
      }


      // --------------------------------------------------------
      // src/file/source = M3U8
      // --------------------------------------------------------

      var sourceRe =
        /(?:src|file|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi;


      while (
        (match = sourceRe.exec(html)) !== null
      ) {

        var stream2 =
          match[1];

        if (seen[stream2]) {
          continue;
        }

        seen[stream2] = true;

        sources.push({

          url:
            stream2,

          quality:
            '1080p',

          container:
            'hls',

          headers: {

            'User-Agent':
              UA,

            'Referer':
              url

          },

          kind:
            'sub',

          audioLang:
            'es',

          subtitles:
            []

        });
      }


      return sources;

    })
    .catch(function () {

      return [];

    });
}


// ============================================================
// COMPATIBILITY
// ============================================================

function getVideoSource(url, options) {
  return getVideoSources(url, options);
}
