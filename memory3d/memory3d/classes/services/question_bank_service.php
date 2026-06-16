<?php
namespace mod_memory3d\services;

defined('MOODLE_INTERNAL') || die();

class question_bank_service {
    private const SUPPORTED_QTYPES_MEMORY = ['multichoice', 'truefalse', 'shortanswer', 'numerical'];
    private const SUPPORTED_QTYPES_DRAGFILL = ['shortanswer', 'numerical', 'multichoice'];
    private const SUPPORTED_QTYPES_CLASSIFIER = ['multichoice', 'truefalse', 'shortanswer'];
    private const SUPPORTED_QTYPES_INTRUDER = ['multichoice', 'truefalse', 'shortanswer'];
    private const CATEGORY_ALL = -1;

    public static function get_category_options(int $courseid): array {
        global $DB;

        $options = [0 => get_string('sourceqcategorynone', 'memory3d')];
        if ($courseid <= 0) {
            return $options;
        }

        $coursecontext = \context_course::instance($courseid, IGNORE_MISSING);
        if (!$coursecontext) {
            return $options;
        }

        try {
            $total = self::count_questions_in_course($courseid);
            $options[self::CATEGORY_ALL] = get_string('sourceqcategoryall', 'memory3d', $total);

            $sql = "SELECT qc.id, qc.name, c.contextlevel
                      FROM {question_categories} qc
                      JOIN {context} c ON c.id = qc.contextid
                     WHERE c.id = :coursectxid OR c.contextlevel = :systemlevel
                  ORDER BY c.contextlevel DESC, qc.name ASC";
            $params = [
                'coursectxid' => (int)$coursecontext->id,
                'systemlevel' => CONTEXT_SYSTEM,
            ];
            $records = $DB->get_records_sql($sql, $params);
            foreach ($records as $record) {
                $prefix = ((int)$record->contextlevel === CONTEXT_SYSTEM) ? '[Sistema] ' : '';
                $count = self::count_questions_in_category((int)$record->id);
                $options[(int)$record->id] = $prefix . format_string((string)$record->name) . ' (' . $count . ')';
            }
        } catch (\Throwable $e) {
            // Evita romper el formulario si hay diferencias de esquema o permisos.
            return $options;
        }

        return $options;
    }

    public static function extract_pairs_from_category(int $categoryid, int $maxpairs, string $gamemode = 'memory'): array {
        return self::extract_pairs_from_scope(null, $categoryid, $maxpairs, $gamemode);
    }

    public static function extract_pairs_from_course(int $courseid, int $maxpairs, string $gamemode = 'memory'): array {
        return self::extract_pairs_from_scope($courseid, self::CATEGORY_ALL, $maxpairs, $gamemode);
    }

    private static function extract_pairs_from_scope(?int $courseid, int $categoryid, int $maxpairs, string $gamemode = 'memory'): array {
        global $DB;

        $maxpairs = max(1, min(500, $maxpairs));
        if ($categoryid === 0) {
            return [];
        }
        $supportedqtypes = self::get_supported_qtypes($gamemode);
        if (empty($supportedqtypes)) {
            return [];
        }

        try {
            $questioncolumns = $DB->get_columns('question');
            if (empty($questioncolumns)) {
                return [];
            }

            $fromclause = 'FROM {question} q';
            $whereparts = [];
            if (!empty($questioncolumns['category'])) {
                if ($categoryid === self::CATEGORY_ALL) {
                    $categoryids = self::get_accessible_category_ids((int)$courseid);
                    if (empty($categoryids)) {
                        return [];
                    }
                    list($insql, $inparams) = $DB->get_in_or_equal($categoryids, SQL_PARAMS_NAMED, 'qcat');
                    $whereparts[] = 'q.category ' . $insql;
                } else {
                    $whereparts[] = 'q.category = :categoryid';
                }
            } else {
                $qbecolumns = $DB->get_columns('question_bank_entries');
                $qvcolumns = $DB->get_columns('question_versions');
                if (empty($qbecolumns['id']) || empty($qbecolumns['questioncategoryid']) ||
                    empty($qvcolumns['questionid']) || empty($qvcolumns['questionbankentryid'])) {
                    return [];
                }
                $fromclause .= ' JOIN {question_versions} qv ON qv.questionid = q.id';
                $fromclause .= ' JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid';
                if ($categoryid === self::CATEGORY_ALL) {
                    $categoryids = self::get_accessible_category_ids((int)$courseid);
                    if (empty($categoryids)) {
                        return [];
                    }
                    list($insql, $inparams) = $DB->get_in_or_equal($categoryids, SQL_PARAMS_NAMED, 'qcat');
                    $whereparts[] = 'qbe.questioncategoryid ' . $insql;
                } else {
                    $whereparts[] = 'qbe.questioncategoryid = :categoryid';
                }
                if (!empty($qvcolumns['status'])) {
                    $whereparts[] = "qv.status = 'ready'";
                }
            }
            if (!empty($questioncolumns['parent'])) {
                $whereparts[] = 'q.parent = 0';
            }
            if (!empty($questioncolumns['hidden'])) {
                $whereparts[] = 'q.hidden = 0';
            }
            if (!empty($questioncolumns['qtype'])) {
                $whereparts[] = "q.qtype IN ('" . implode("','", $supportedqtypes) . "')";
            }

            $selectquestiontext = !empty($questioncolumns['questiontext']) ? 'q.questiontext' : "'' AS questiontext";
            $selectqtype = !empty($questioncolumns['qtype']) ? 'q.qtype' : "'' AS qtype";
            $sql = "SELECT q.id, {$selectqtype}, {$selectquestiontext}
                      {$fromclause}
                     WHERE " . implode(' AND ', $whereparts) . "
                  ORDER BY q.id DESC";
            $params = [];
            if (isset($inparams) && is_array($inparams)) {
                $params = array_merge($params, $inparams);
            }
            if ($categoryid !== self::CATEGORY_ALL) {
                $params['categoryid'] = $categoryid;
            }
            $questions = $DB->get_records_sql($sql, $params);
            if (!$questions) {
                return [];
            }
        } catch (\Throwable $e) {
            return [];
        }

        $pairs = [];
        foreach ($questions as $question) {
            $questiontext = self::clean_text((string)$question->questiontext);
            if ($questiontext === '') {
                continue;
            }

            $answer = self::find_best_answer((int)$question->id);
            if ($answer === '') {
                continue;
            }

            $pairs[] = [
                'question' => self::limit_words($questiontext, 18),
                'answer' => self::limit_words($answer, 10),
            ];

            if (count($pairs) >= $maxpairs) {
                break;
            }
        }

        return $pairs;
    }

    public static function count_questions_in_category(int $categoryid, string $gamemode = 'memory'): int {
        return self::count_questions_in_scope(null, $categoryid, $gamemode);
    }

    public static function count_questions_in_course(int $courseid, string $gamemode = 'memory'): int {
        return self::count_questions_in_scope($courseid, self::CATEGORY_ALL, $gamemode);
    }

    private static function count_questions_in_scope(?int $courseid, int $categoryid, string $gamemode = 'memory'): int {
        global $DB;

        if ($categoryid === 0) {
            return 0;
        }
        $supportedqtypes = self::get_supported_qtypes($gamemode);
        if (empty($supportedqtypes)) {
            return 0;
        }

        try {
            $questioncolumns = $DB->get_columns('question');
            if (empty($questioncolumns)) {
                return 0;
            }

            $fromclause = 'FROM {question} q';
            $whereparts = [];
            if (!empty($questioncolumns['category'])) {
                if ($categoryid === self::CATEGORY_ALL) {
                    $categoryids = self::get_accessible_category_ids((int)$courseid);
                    if (empty($categoryids)) {
                        return 0;
                    }
                    list($insql, $inparams) = $DB->get_in_or_equal($categoryids, SQL_PARAMS_NAMED, 'qcat');
                    $whereparts[] = 'q.category ' . $insql;
                } else {
                    $whereparts[] = 'q.category = :categoryid';
                }
            } else {
                $qbecolumns = $DB->get_columns('question_bank_entries');
                $qvcolumns = $DB->get_columns('question_versions');
                if (empty($qbecolumns['id']) || empty($qbecolumns['questioncategoryid']) ||
                    empty($qvcolumns['questionid']) || empty($qvcolumns['questionbankentryid'])) {
                    return 0;
                }
                $fromclause .= ' JOIN {question_versions} qv ON qv.questionid = q.id';
                $fromclause .= ' JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid';
                if ($categoryid === self::CATEGORY_ALL) {
                    $categoryids = self::get_accessible_category_ids((int)$courseid);
                    if (empty($categoryids)) {
                        return 0;
                    }
                    list($insql, $inparams) = $DB->get_in_or_equal($categoryids, SQL_PARAMS_NAMED, 'qcat');
                    $whereparts[] = 'qbe.questioncategoryid ' . $insql;
                } else {
                    $whereparts[] = 'qbe.questioncategoryid = :categoryid';
                }
                if (!empty($qvcolumns['status'])) {
                    $whereparts[] = "qv.status = 'ready'";
                }
            }
            if (!empty($questioncolumns['parent'])) {
                $whereparts[] = 'q.parent = 0';
            }
            if (!empty($questioncolumns['hidden'])) {
                $whereparts[] = 'q.hidden = 0';
            }
            if (!empty($questioncolumns['qtype'])) {
                $whereparts[] = "q.qtype IN ('" . implode("','", $supportedqtypes) . "')";
            }

            $sql = "SELECT COUNT(1)
                      {$fromclause}
                     WHERE " . implode(' AND ', $whereparts);
            $params = [];
            if (isset($inparams) && is_array($inparams)) {
                $params = array_merge($params, $inparams);
            }
            if ($categoryid !== self::CATEGORY_ALL) {
                $params['categoryid'] = $categoryid;
            }
            return (int)$DB->count_records_sql($sql, $params);
        } catch (\Throwable $e) {
            return 0;
        }
    }

    private static function get_accessible_category_ids(int $courseid): array {
        global $DB;
        if ($courseid <= 0) {
            return [];
        }

        $coursecontext = \context_course::instance($courseid, IGNORE_MISSING);
        if (!$coursecontext) {
            return [];
        }
        $sql = "SELECT qc.id
                  FROM {question_categories} qc
                  JOIN {context} c ON c.id = qc.contextid
                 WHERE c.id = :coursectxid OR c.contextlevel = :systemlevel";
        $records = $DB->get_records_sql($sql, [
            'coursectxid' => (int)$coursecontext->id,
            'systemlevel' => CONTEXT_SYSTEM,
        ]);
        if (!$records) {
            return [];
        }
        return array_map('intval', array_keys($records));
    }

    private static function get_supported_qtypes(string $gamemode): array {
        $mode = strtolower(trim($gamemode));
        if ($mode === 'dragfill') {
            return self::SUPPORTED_QTYPES_DRAGFILL;
        }
        if ($mode === 'classifier') {
            return self::SUPPORTED_QTYPES_CLASSIFIER;
        }
        if ($mode === 'intruder') {
            return self::SUPPORTED_QTYPES_INTRUDER;
        }
        return self::SUPPORTED_QTYPES_MEMORY;
    }

    public static function pairs_to_source_text(array $pairs): string {
        $lines = [];
        foreach ($pairs as $pair) {
            if (!is_array($pair)) {
                continue;
            }
            $question = trim((string)($pair['question'] ?? ''));
            $answer = trim((string)($pair['answer'] ?? ''));
            if ($question === '' || $answer === '') {
                continue;
            }
            $lines[] = 'Pregunta: ' . $question . ' | Respuesta: ' . $answer;
        }
        return implode("\n", $lines);
    }

    private static function find_best_answer(int $questionid): string {
        global $DB;

        if ($questionid <= 0) {
            return '';
        }

        try {
            $answercolumns = $DB->get_columns('question_answers');
            if (empty($answercolumns) || empty($answercolumns['question']) || empty($answercolumns['answer'])) {
                return '';
            }

            $sort = 'id ASC';
            if (!empty($answercolumns['fraction'])) {
                $sort = 'fraction DESC, id ASC';
            }
            $fields = 'id, answer';
            if (!empty($answercolumns['fraction'])) {
                $fields .= ', fraction';
            }

            $answers = $DB->get_records(
                'question_answers',
                ['question' => $questionid],
                $sort,
                $fields
            );
        } catch (\Throwable $e) {
            return '';
        }
        if (!$answers) {
            return '';
        }

        foreach ($answers as $answer) {
            $fraction = isset($answer->fraction) ? (float)$answer->fraction : 1.0;
            if ($fraction <= 0) {
                continue;
            }
            $text = self::clean_text((string)$answer->answer);
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private static function clean_text(string $html): string {
        $text = trim(html_to_text($html, 0, false));
        $text = preg_replace('/\s+/u', ' ', $text ?? '');
        return trim((string)$text);
    }

    private static function limit_words(string $text, int $maxwords): string {
        $clean = trim(preg_replace('/\s+/u', ' ', $text));
        if ($clean === '') {
            return '';
        }
        $words = preg_split('/\s+/u', $clean, -1, PREG_SPLIT_NO_EMPTY);
        if (!$words) {
            return '';
        }
        return trim(implode(' ', array_slice($words, 0, $maxwords)));
    }
}
