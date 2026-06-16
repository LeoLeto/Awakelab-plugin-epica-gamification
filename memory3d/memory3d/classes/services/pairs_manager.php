<?php
namespace mod_memory3d\services;

defined('MOODLE_INTERNAL') || die();

class pairs_manager {
    public static function prepare_defaults(\stdClass &$memory3d, ?\stdClass $current = null): void {
        $memory3d->requestedpairs = max(2, min(15, (int)($memory3d->requestedpairs ?? 6)));
        $memory3d->difficulty = self::normalize_difficulty((string)($memory3d->difficulty ?? ($current->difficulty ?? 'medium')));
        $memory3d->gamemode = self::normalize_game_mode((string)($memory3d->gamemode ?? ($current->gamemode ?? 'memory')));
        $memory3d->sourceorigin = self::normalize_source_origin((string)($memory3d->sourceorigin ?? ($current->sourceorigin ?? 'pdftext')));
        $memory3d->sourcecmid = (int)($memory3d->sourcecmid ?? ($current->sourcecmid ?? 0));
        $memory3d->sourceqcategoryid = (int)($memory3d->sourceqcategoryid ?? ($current->sourceqcategoryid ?? 0));
        $memory3d->qbankuseai = !empty($memory3d->qbankuseai ?? ($current->qbankuseai ?? 0)) ? 1 : 0;
        $memory3d->qbankmixmode = self::normalize_qbank_mix_mode((string)($memory3d->qbankmixmode ?? ($current->qbankmixmode ?? 'exact')));
        $memory3d->qbankaiextra = max(0, min(15, (int)($memory3d->qbankaiextra ?? ($current->qbankaiextra ?? 0))));
        $memory3d->qbankaipercent = max(0, min(90, (int)($memory3d->qbankaipercent ?? ($current->qbankaipercent ?? 0))));
        $memory3d->gradepolicy = self::normalize_grade_policy((string)($memory3d->gradepolicy ?? ($current->gradepolicy ?? 'best')));

        if (!isset($memory3d->pairscount)) {
            $memory3d->pairscount = $current ? (int)$current->pairscount : 0;
        }
        if (!isset($memory3d->pairsjson)) {
            $memory3d->pairsjson = $current ? (string)$current->pairsjson : '[]';
        }
        if (!isset($memory3d->lastaierror)) {
            $memory3d->lastaierror = $current ? (string)$current->lastaierror : '';
        }
        if (!isset($memory3d->aigeneratedat)) {
            $memory3d->aigeneratedat = $current ? (int)$current->aigeneratedat : 0;
        }
    }

    public static function normalize_difficulty(string $difficulty): string {
        $difficulty = strtolower(trim($difficulty));
        if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
            return 'medium';
        }
        return $difficulty;
    }

    public static function normalize_game_mode(string $gamemode): string {
        $gamemode = strtolower(trim($gamemode));
        if (!in_array($gamemode, ['memory', 'dragfill', 'classifier', 'intruder'], true)) {
            return 'memory';
        }
        return $gamemode;
    }

    public static function normalize_source_origin(string $sourceorigin): string {
        $sourceorigin = strtolower(trim($sourceorigin));
        if (!in_array($sourceorigin, ['pdftext', 'resource', 'qbank'], true)) {
            return 'pdftext';
        }
        return $sourceorigin;
    }

    public static function normalize_qbank_mix_mode(string $mixmode): string {
        $mixmode = strtolower(trim($mixmode));
        if (!in_array($mixmode, ['exact', 'percent'], true)) {
            return 'exact';
        }
        return $mixmode;
    }

    public static function normalize_grade_policy(string $policy): string {
        $policy = strtolower(trim($policy));
        if (!in_array($policy, ['best', 'last', 'average'], true)) {
            return 'best';
        }
        return $policy;
    }

    public static function build_db_record(\stdClass $source): \stdClass {
        global $DB;
        $columns = $DB->get_columns('memory3d');
        $record = new \stdClass();
        foreach ($columns as $name => $unused) {
            if (property_exists($source, $name)) {
                $record->{$name} = $source->{$name};
            }
        }
        return $record;
    }

    public static function try_generate_pairs(\stdClass &$memory3d): void {
        $config = get_config('memory3d');
        if (empty($config->enabled)) {
            $memory3d->lastaierror = get_string('aierrordisabled', 'memory3d');
            return;
        }

        try {
            $sourceorigin = self::normalize_source_origin((string)($memory3d->sourceorigin ?? 'pdftext'));
            if ($sourceorigin === 'resource' && !empty($memory3d->sourcecmid)) {
                $resourcefile = pdf_file_service::get_course_resource_file(
                    (int)($memory3d->course ?? 0),
                    (int)$memory3d->sourcecmid
                );
                if (!$resourcefile) {
                    throw new \moodle_exception('aierrornoresourcefile', 'memory3d');
                }
                $pairs = backend_client::generate_from_pdf_stored_file(
                    $resourcefile,
                    (int)$memory3d->requestedpairs,
                    (string)$memory3d->name,
                    self::normalize_difficulty((string)($memory3d->difficulty ?? 'medium')),
                    self::normalize_game_mode((string)($memory3d->gamemode ?? 'memory'))
                );
            } else if ($sourceorigin === 'qbank' && !empty($memory3d->sourceqcategoryid)) {
                $sourceqcategoryid = (int)$memory3d->sourceqcategoryid;
                $gamemode = self::normalize_game_mode((string)($memory3d->gamemode ?? 'memory'));
                $maxpairs = max(2, min(15, (int)($config->maxpairs ?? 15)));
                $qbankuseai = !empty($memory3d->qbankuseai);
                $qbankmixmode = self::normalize_qbank_mix_mode((string)($memory3d->qbankmixmode ?? 'exact'));
                $qbankaiextra = max(0, (int)($memory3d->qbankaiextra ?? 0));
                $qbankaipercent = max(0, min(90, (int)($memory3d->qbankaipercent ?? 0)));
                if ($sourceqcategoryid < 0) {
                    $available = question_bank_service::count_questions_in_course((int)($memory3d->course ?? 0), $gamemode);
                } else {
                    $available = question_bank_service::count_questions_in_category($sourceqcategoryid, $gamemode);
                }
                if ($available <= 0) {
                    throw new \moodle_exception('aierrornoqbankpairs', 'memory3d');
                }
                $basecount = min($maxpairs, (int)$available);
                $aiextra = 0;
                if ($sourceqcategoryid > 0 && $qbankuseai) {
                    if ($qbankmixmode === 'percent') {
                        // IA% sobre total: extra = base * p / (100 - p).
                        $aiextra = (int)round(($basecount * $qbankaipercent) / max(1, (100 - $qbankaipercent)));
                    } else {
                        $aiextra = $qbankaiextra;
                    }
                    $aiextra = min($aiextra, max(0, $maxpairs - $basecount));
                }
                $requestedpairs = $basecount + $aiextra;
                if ($sourceqcategoryid < 0) {
                    $basepairs = question_bank_service::extract_pairs_from_course(
                        (int)($memory3d->course ?? 0),
                        $basecount,
                        $gamemode
                    );
                } else {
                    $basepairs = question_bank_service::extract_pairs_from_category(
                        $sourceqcategoryid,
                        $basecount,
                        $gamemode
                    );
                }
                if (empty($basepairs)) {
                    throw new \moodle_exception('aierrornoqbankpairs', 'memory3d');
                }

                if ($gamemode === 'memory') {
                    $pairs = array_slice($basepairs, 0, $basecount);
                    self::fill_with_ai_memory_pairs($pairs, $requestedpairs, (string)$memory3d->name, self::normalize_difficulty((string)($memory3d->difficulty ?? 'medium')));
                } else {
                    $sourcetext = question_bank_service::pairs_to_source_text($basepairs);
                    $pairs = backend_client::generate_from_text(
                        $sourcetext,
                        $requestedpairs,
                        (string)$memory3d->name,
                        self::normalize_difficulty((string)($memory3d->difficulty ?? 'medium')),
                        $gamemode
                    );
                }
            } else if (pdf_file_service::has_pdf_file($memory3d)) {
                $pairs = backend_client::generate_from_pdf(
                    $memory3d,
                    (int)$memory3d->requestedpairs,
                    (string)$memory3d->name,
                    self::normalize_game_mode((string)($memory3d->gamemode ?? 'memory'))
                );
            } else {
                if (empty($memory3d->sourcetext)) {
                    throw new \moodle_exception('aierrornosourcetext', 'memory3d');
                }
                $pairs = backend_client::generate_from_text(
                    (string)$memory3d->sourcetext,
                    (int)$memory3d->requestedpairs,
                    (string)$memory3d->name,
                    self::normalize_difficulty((string)($memory3d->difficulty ?? 'medium')),
                    self::normalize_game_mode((string)($memory3d->gamemode ?? 'memory'))
                );
            }

            $memory3d->pairsjson = json_encode($pairs);
            $memory3d->pairscount = count($pairs);
            $memory3d->lastaierror = '';
            $memory3d->aigeneratedat = time();
        } catch (\Exception $e) {
            $memory3d->lastaierror = $e->getMessage();
        }
    }

    private static function fill_with_ai_memory_pairs(array &$pairs, int $requestedpairs, string $activityname, string $difficulty): void {
        $requestedpairs = max(0, $requestedpairs);
        if (count($pairs) >= $requestedpairs) {
            return;
        }

        $tries = 2;
        while (count($pairs) < $requestedpairs && $tries > 0) {
            $missing = $requestedpairs - count($pairs);
            $sourcetext = question_bank_service::pairs_to_source_text($pairs);
            try {
                $generated = backend_client::generate_from_text(
                    $sourcetext,
                    $missing + 2,
                    $activityname,
                    $difficulty,
                    'memory'
                );
            } catch (\Throwable $e) {
                return;
            }

            $seen = [];
            for ($i = 0; $i < count($pairs); $i++) {
                $q = strtolower(trim((string)($pairs[$i]['question'] ?? '')));
                $a = strtolower(trim((string)($pairs[$i]['answer'] ?? '')));
                if ($q === '' || $a === '') {
                    continue;
                }
                $seen[$q . '||' . $a] = true;
            }

            for ($j = 0; $j < count($generated) && count($pairs) < $requestedpairs; $j++) {
                $gq = trim((string)($generated[$j]['question'] ?? ''));
                $ga = trim((string)($generated[$j]['answer'] ?? ''));
                if ($gq === '' || $ga === '') {
                    continue;
                }
                $key = strtolower($gq) . '||' . strtolower($ga);
                if (!empty($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $pairs[] = ['question' => $gq, 'answer' => $ga];
            }
            $tries--;
        }
    }
}
