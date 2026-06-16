<?php
define('AJAX_SCRIPT', true);

require(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw ?: '{}', true);
if (!is_array($payload)) {
    $payload = [];
}

$cmid = isset($payload['cmid']) ? (int)$payload['cmid'] : 0;
$sesskey = isset($payload['sesskey']) ? (string)$payload['sesskey'] : '';
$rawscore = isset($payload['score']) ? (float)$payload['score'] : 0.0;
$maxscore = isset($payload['maxscore']) ? (float)$payload['maxscore'] : 0.0;
$gamemode = isset($payload['gamemode']) ? clean_param((string)$payload['gamemode'], PARAM_ALPHA) : 'memory';

if ($cmid <= 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid course module id']);
    exit;
}

if (!confirm_sesskey($sesskey)) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Invalid sesskey']);
    exit;
}

$cm = get_coursemodule_from_id('memory3d', $cmid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$memory3d = $DB->get_record('memory3d', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/memory3d:view', $context);

$gamemode = \mod_memory3d\services\pairs_manager::normalize_game_mode($gamemode);
$rawscore = max(0.0, $rawscore);
$maxscore = max(0.0, $maxscore);
$finalgrade = ($maxscore > 0) ? (($rawscore / $maxscore) * 100.0) : 0.0;
$finalgrade = max(0.0, min(100.0, $finalgrade));

$now = time();
$attempt = new stdClass();
$attempt->memory3did = (int)$memory3d->id;
$attempt->userid = (int)$USER->id;
$attempt->gamemode = $gamemode;
$attempt->rawscore = round($rawscore, 2);
$attempt->maxscore = round($maxscore, 2);
$attempt->finalgrade = round($finalgrade, 5);
$attempt->timecreated = $now;
$attempt->timemodified = $now;
$DB->insert_record('memory3d_attempts', $attempt);

memory3d_update_user_grade($memory3d, (int)$USER->id);

echo json_encode([
    'status' => 'success',
    'grade' => $attempt->finalgrade,
]);
