<?php
namespace mod_memory3d\services;

defined('MOODLE_INTERNAL') || die();

require_once($GLOBALS['CFG']->libdir . '/filelib.php');

class backend_client {
    public static function generate_from_text(
        string $sourcetext,
        int $requestedpairs,
        string $activityname,
        string $difficulty,
        string $gamemode = 'memory'
    ): array {
        $config = get_config('memory3d');
        $backendurl = self::resolve_text_endpoint($config);

        if ($backendurl === '') {
            throw new \moodle_exception('aierrornourl', 'memory3d');
        }

        $maxpairs = max(2, min(15, (int)($config->maxpairs ?? 15)));
        $requestedpairs = max(2, min($maxpairs, $requestedpairs));

        $payload = [
            'text' => trim($sourcetext),
            'maxPairs' => $requestedpairs,
            'activityName' => trim($activityname),
            'maxWordsPerSide' => 10,
            'difficulty' => pairs_manager::normalize_difficulty($difficulty),
            'gameMode' => pairs_manager::normalize_game_mode($gamemode),
        ];

        if (!empty($config->model)) {
            $payload['model'] = trim($config->model);
        }
        if (!empty($config->apikey)) {
            $payload['openaiKey'] = trim($config->apikey);
        }
        if (!empty($config->mongo_uri)) {
            $payload['mongoUri'] = trim($config->mongo_uri);
        }
        if (!empty($config->mongo_db_name)) {
            $payload['mongoDbName'] = trim($config->mongo_db_name);
        }
        $headers = ['Content-Type: application/json'];
        if (!empty($config->apikey)) {
            $headers[] = 'Authorization: Bearer ' . trim($config->apikey);
            $headers[] = 'X-API-Key: ' . trim($config->apikey);
        }
        if (!empty($config->model)) {
            $headers[] = 'X-Model: ' . trim($config->model);
        }

        $timeout = max(5, (int)($config->timeoutseconds ?? 30));
        $response = '';
        $httpcode = 0;
        $attempttimeouts = [$timeout, max($timeout, 75)];
        for ($attempt = 0; $attempt < count($attempttimeouts); $attempt++) {
            $curl = new \curl();
            $response = $curl->post($backendurl, json_encode($payload), [
                'CURLOPT_HTTPHEADER' => $headers,
                'CURLOPT_TIMEOUT' => $attempttimeouts[$attempt],
                'CURLOPT_CONNECTTIMEOUT' => 10,
            ]);
            $httpcode = (int)($curl->get_info()['http_code'] ?? 0);
            if (!self::is_retryable_timeout_response($response, $httpcode) || $attempt === count($attempttimeouts) - 1) {
                break;
            }
        }

        return self::decode_backend_response(
            $response,
            $httpcode,
            pairs_manager::normalize_game_mode($gamemode)
        );
    }

    public static function generate_from_pdf(
        \stdClass $memory3d,
        int $requestedpairs,
        string $activityname,
        string $gamemode = 'memory'
    ): array {
        $config = get_config('memory3d');
        $backendurl = self::resolve_pdf_endpoint($config);
        if ($backendurl === '') {
            throw new \moodle_exception('aierrornourlpdf', 'memory3d');
        }

        $pdffile = pdf_file_service::get_stored_file($memory3d);
        if (!$pdffile) {
            throw new \moodle_exception('aierrornopdf', 'memory3d');
        }

        return self::generate_from_pdf_stored_file(
            $pdffile,
            $requestedpairs,
            $activityname,
            pairs_manager::normalize_difficulty((string)($memory3d->difficulty ?? 'medium')),
            $gamemode
        );
    }

    public static function generate_from_pdf_stored_file(
        \stored_file $pdffile,
        int $requestedpairs,
        string $activityname,
        string $difficulty,
        string $gamemode = 'memory'
    ): array {
        $config = get_config('memory3d');
        $backendurl = self::resolve_pdf_endpoint($config);
        if ($backendurl === '') {
            throw new \moodle_exception('aierrornourlpdf', 'memory3d');
        }

        $maxpairs = max(2, min(15, (int)($config->maxpairs ?? 15)));
        $requestedpairs = max(2, min($maxpairs, $requestedpairs));

        $tempdir = make_request_directory();
        $filename = $pdffile->get_filename();
        $temppath = $tempdir . '/' . $filename;
        $pdffile->copy_content_to($temppath);

        $payload = [
            'file' => curl_file_create($temppath, 'application/pdf', $filename),
            'max_pairs' => (string)$requestedpairs,
            'max_words_per_side' => '10',
            'activity_name' => (string)$activityname,
            'difficulty' => pairs_manager::normalize_difficulty((string)$difficulty),
            'game_mode' => pairs_manager::normalize_game_mode($gamemode),
        ];

        if (!empty($config->model)) {
            $payload['model'] = trim($config->model);
        }
        if (!empty($config->apikey)) {
            $payload['openai_key'] = trim($config->apikey);
        }
        if (!empty($config->mongo_uri)) {
            $payload['mongo_uri'] = trim($config->mongo_uri);
        }
        if (!empty($config->mongo_db_name)) {
            $payload['mongo_db_name'] = trim($config->mongo_db_name);
        }
        $headers = [];
        if (!empty($config->apikey)) {
            $headers[] = 'Authorization: Bearer ' . trim($config->apikey);
            $headers[] = 'X-API-Key: ' . trim($config->apikey);
        }

        $timeout = max(5, (int)($config->timeoutseconds ?? 30));
        $response = '';
        $curlerror = '';
        $httpcode = 0;
        $attempttimeouts = [$timeout, max($timeout, 75)];
        for ($attempt = 0; $attempt < count($attempttimeouts); $attempt++) {
            $ch = curl_init($backendurl);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_TIMEOUT, $attempttimeouts[$attempt]);
            if (!empty($headers)) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            }

            $response = curl_exec($ch);
            $curlerror = curl_error($ch);
            $httpcode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if (!self::is_retryable_timeout_response($response, $httpcode, $curlerror) ||
                $attempt === count($attempttimeouts) - 1) {
                break;
            }
        }

        if (!empty($curlerror)) {
            throw new \moodle_exception('aierrorcurl', 'memory3d', '', $curlerror);
        }
        return self::decode_backend_response($response, $httpcode, pairs_manager::normalize_game_mode($gamemode));
    }

    private static function resolve_text_endpoint(\stdClass $config): string {
        $baseurl = trim((string)($config->microservice_url ?? ''));
        if ($baseurl !== '') {
            if (preg_match('#/api/pairs_from_pdf/?$#', $baseurl)) {
                return preg_replace('#/api/pairs_from_pdf/?$#', '/api/pairs', $baseurl);
            }
            if (preg_match('#/api/pairs/?$#', $baseurl)) {
                return $baseurl;
            }
            return rtrim($baseurl, '/') . '/api/pairs';
        }

        // Backward compatibility with previous setting.
        $legacy = trim((string)($config->backendurl ?? ''));
        return $legacy;
    }

    private static function resolve_pdf_endpoint(\stdClass $config): string {
        $baseurl = trim((string)($config->microservice_url ?? ''));
        if ($baseurl !== '') {
            if (preg_match('#/api/pairs/?$#', $baseurl)) {
                return preg_replace('#/api/pairs/?$#', '/api/pairs_from_pdf', $baseurl);
            }
            if (preg_match('#/api/pairs_from_pdf/?$#', $baseurl)) {
                return $baseurl;
            }
            return rtrim($baseurl, '/') . '/api/pairs_from_pdf';
        }

        // Backward compatibility with previous settings.
        $legacy = trim((string)($config->backendpdfurl ?? ''));
        if ($legacy !== '') {
            return $legacy;
        }
        $legacytext = trim((string)($config->backendurl ?? ''));
        if ($legacytext === '') {
            return '';
        }
        if (preg_match('#/pairs/?$#', $legacytext)) {
            return preg_replace('#/pairs/?$#', '/pairs_from_pdf', $legacytext);
        }
        return rtrim($legacytext, '/') . '/pairs_from_pdf';
    }

    private static function decode_backend_response($response, int $httpcode, string $gamemode): array {
        if ($httpcode >= 300 && $httpcode < 400) {
            throw new \moodle_exception('aierrorhttp', 'memory3d', '', $httpcode);
        }
        if ($httpcode >= 400) {
            throw new \moodle_exception('aierrorhttp', 'memory3d', '', $httpcode);
        }
        if (!is_string($response) || trim($response) === '') {
            throw new \moodle_exception('aierroremptyresponse', 'memory3d');
        }
        $body = trim($response);
        if (strncmp($body, "\xEF\xBB\xBF", 3) === 0) {
            $body = substr($body, 3);
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            $firstbrace = strpos($body, '{');
            $lastbrace = strrpos($body, '}');
            if ($firstbrace !== false && $lastbrace !== false && $lastbrace > $firstbrace) {
                $jsonslice = substr($body, $firstbrace, $lastbrace - $firstbrace + 1);
                $decoded = json_decode($jsonslice, true);
            }
        }
        if (!is_array($decoded)) {
            throw new \moodle_exception('aierrorinvalidjson', 'memory3d');
        }

        if ($gamemode === 'dragfill') {
            $pairs = self::extract_dragfill_items($decoded);
        } else if ($gamemode === 'classifier') {
            $pairs = self::extract_classifier_items($decoded);
        } else if ($gamemode === 'intruder') {
            $pairs = self::extract_intruder_items($decoded);
        } else {
            $pairs = self::extract_pairs($decoded);
        }
        if (empty($pairs)) {
            throw new \moodle_exception('aierrornopairs', 'memory3d');
        }
        return $pairs;
    }

    private static function extract_pairs(array $response): array {
        $rawpairs = [];
        if (!empty($response['pairs']) && is_array($response['pairs'])) {
            $rawpairs = $response['pairs'];
        } else if (!empty($response['data']) && is_array($response['data'])) {
            $rawpairs = $response['data'];
        }

        $pairs = [];
        foreach ($rawpairs as $rawpair) {
            if (!is_array($rawpair)) {
                continue;
            }
            $question = '';
            $answer = '';
            if (isset($rawpair['question'])) {
                $question = (string)$rawpair['question'];
            } else if (isset($rawpair['q'])) {
                $question = (string)$rawpair['q'];
            }
            if (isset($rawpair['answer'])) {
                $answer = (string)$rawpair['answer'];
            } else if (isset($rawpair['a'])) {
                $answer = (string)$rawpair['a'];
            }

            $question = self::limit_words($question, 10);
            $answer = self::limit_words($answer, 10);
            if ($question === '' || $answer === '') {
                continue;
            }
            $pairs[] = ['question' => $question, 'answer' => $answer];
        }

        return $pairs;
    }

    private static function extract_dragfill_items(array $response): array {
        $rawitems = [];
        if (!empty($response['pairs']) && is_array($response['pairs'])) {
            // El backend reutiliza la clave "pairs" para mantener compatibilidad.
            $rawitems = $response['pairs'];
        } else if (!empty($response['items']) && is_array($response['items'])) {
            $rawitems = $response['items'];
        }

        $items = [];
        foreach ($rawitems as $rawitem) {
            if (!is_array($rawitem)) {
                continue;
            }

            $sentence = trim((string)($rawitem['sentence'] ?? ''));
            $answer = trim((string)($rawitem['answer'] ?? ''));
            $options = $rawitem['options'] ?? [];

            if (is_string($options)) {
                $options = array_map('trim', explode(',', $options));
            }
            if (!is_array($options)) {
                $options = [];
            }

            $cleanoptions = [];
            foreach ($options as $opt) {
                $opt = self::limit_words((string)$opt, 10);
                if ($opt !== '' && !in_array($opt, $cleanoptions, true)) {
                    $cleanoptions[] = $opt;
                }
            }

            $answer = self::limit_words($answer, 10);
            $sentence = preg_replace('/\s+/u', ' ', $sentence ?? '');

            if ($sentence === '' || $answer === '' || strpos($sentence, '_____') === false) {
                continue;
            }
            if (!in_array($answer, $cleanoptions, true)) {
                $cleanoptions[] = $answer;
            }
            if (count($cleanoptions) < 3) {
                continue;
            }

            $items[] = [
                'sentence' => $sentence,
                'answer' => $answer,
                'options' => array_values($cleanoptions),
            ];
        }

        return $items;
    }

    private static function extract_classifier_items(array $response): array {
        $rawitems = [];
        if (!empty($response['pairs']) && is_array($response['pairs'])) {
            $rawitems = $response['pairs'];
        } else if (!empty($response['items']) && is_array($response['items'])) {
            $rawitems = $response['items'];
        }

        $items = [];
        foreach ($rawitems as $rawitem) {
            if (!is_array($rawitem)) {
                continue;
            }

            $concept = (string)($rawitem['concept'] ?? $rawitem['term'] ?? $rawitem['item'] ?? $rawitem['question'] ?? $rawitem['q'] ?? '');
            $category = (string)($rawitem['category'] ?? $rawitem['group'] ?? $rawitem['class'] ?? $rawitem['answer'] ?? $rawitem['a'] ?? '');
            $concept = self::limit_words($concept, 10);
            $category = self::limit_words($category, 10);
            if ($concept === '' || $category === '') {
                continue;
            }
            $items[] = [
                'concept' => $concept,
                'category' => $category,
            ];
        }

        return $items;
    }

    private static function extract_intruder_items(array $response): array {
        $rawitems = [];
        if (!empty($response['pairs']) && is_array($response['pairs'])) {
            $rawitems = $response['pairs'];
        } else if (!empty($response['items']) && is_array($response['items'])) {
            $rawitems = $response['items'];
        }

        $items = [];
        foreach ($rawitems as $rawitem) {
            if (!is_array($rawitem)) {
                continue;
            }

            $category = (string)($rawitem['category'] ?? $rawitem['topic'] ?? $rawitem['theme'] ?? '');
            $intruder = (string)($rawitem['intruder'] ?? $rawitem['odd'] ?? $rawitem['wrong'] ?? '');
            $category = self::limit_words($category, 10);
            $intruder = self::limit_words($intruder, 10);

            $optionsraw = $rawitem['options'] ?? [];
            if (is_string($optionsraw)) {
                $optionsraw = array_map('trim', explode(',', $optionsraw));
            }
            if (!is_array($optionsraw)) {
                $optionsraw = [];
            }

            $options = [];
            foreach ($optionsraw as $opt) {
                $clean = self::limit_words((string)$opt, 10);
                if ($clean !== '' && !in_array(strtolower($clean), array_map('strtolower', $options), true)) {
                    $options[] = $clean;
                }
            }

            if ($intruder !== '' && !in_array(strtolower($intruder), array_map('strtolower', $options), true)) {
                $options[] = $intruder;
            }

            if ($category === '' || $intruder === '' || count($options) < 4) {
                continue;
            }

            $options = array_values(array_slice($options, 0, 4));
            if (!in_array(strtolower($intruder), array_map('strtolower', $options), true)) {
                continue;
            }

            $items[] = [
                'category' => $category,
                'intruder' => $intruder,
                'options' => $options,
            ];
        }

        return $items;
    }

    private static function limit_words(string $text, int $maxwords): string {
        $clean = trim(preg_replace('/\s+/u', ' ', strip_tags($text)));
        if ($clean === '') {
            return '';
        }
        $words = preg_split('/\s+/u', $clean, -1, PREG_SPLIT_NO_EMPTY);
        if (!$words) {
            return '';
        }
        return trim(implode(' ', array_slice($words, 0, $maxwords)));
    }

    private static function is_retryable_timeout_response($response, int $httpcode, string $curlerror = ''): bool {
        if ($httpcode >= 200) {
            return false;
        }
        $bodyempty = !is_string($response) || trim($response) === '';
        if (!$bodyempty && $curlerror === '') {
            return false;
        }
        if ($curlerror !== '') {
            return stripos($curlerror, 'timed out') !== false;
        }
        return true;
    }
}
