<?php
require(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT);

$cm = get_coursemodule_from_id('memory3d', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$memory3d = $DB->get_record('memory3d', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/memory3d:view', $context);

$PAGE->set_url('/mod/memory3d/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($memory3d->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->requires->css(new moodle_url('/mod/memory3d/styles.css'));

$pairs = json_decode((string)$memory3d->pairsjson, true);
if (!is_array($pairs)) {
    $pairs = [];
}
$gamemode = \mod_memory3d\services\pairs_manager::normalize_game_mode((string)($memory3d->gamemode ?? 'memory'));

$payload = [
    'instanceid' => (int)$memory3d->id,
    'cmid' => (int)$cm->id,
    'sesskey' => sesskey(),
    'reporturl' => (string)(new moodle_url('/mod/memory3d/save_score.php')),
    'name' => (string)$memory3d->name,
    'pairs' => $pairs,
    'items' => $pairs,
    'gamemode' => $gamemode,
    'pairscount' => (int)$memory3d->pairscount,
    'generatedat' => (int)$memory3d->aigeneratedat,
];

echo $OUTPUT->header();

echo $OUTPUT->heading(format_string($memory3d->name));

echo format_module_intro('memory3d', $memory3d, $cm->id);

echo html_writer::start_div('memory3d-ui', ['id' => 'memory3d-ui']);
echo html_writer::div('Puntuacion: 0', 'memory3d-score', ['id' => 'memory3d-score']);
echo html_writer::tag('button', 'Confirmar', [
    'id' => 'memory3d-confirm',
    'class' => 'btn btn-primary',
    'type' => 'button',
    'disabled' => 'disabled',
]);
$initialmessage = 'Cargando...';
echo html_writer::div(
    $initialmessage,
    'memory3d-message',
    ['id' => 'memory3d-message']
);
echo html_writer::end_div();

echo html_writer::div('', 'memory3d-canvas-container', ['id' => 'memory3d-canvas-container']);
echo html_writer::tag('script', json_encode($payload), ['type' => 'application/json', 'id' => 'memory3d-data']);

$threeurl = new moodle_url('/mod/memory3d/js/vendor/three.min.js', ['v' => @filemtime(__DIR__ . '/js/vendor/three.min.js') ?: time()]);
$loaderurl = new moodle_url('/mod/memory3d/js/three/loader.js', ['v' => @filemtime(__DIR__ . '/js/three/loader.js') ?: time()]);
$cardsurl = new moodle_url('/mod/memory3d/js/three/cards.js', ['v' => @filemtime(__DIR__ . '/js/three/cards.js') ?: time()]);
$sceneurl = new moodle_url('/mod/memory3d/js/three/scene.js', ['v' => @filemtime(__DIR__ . '/js/three/scene.js') ?: time()]);
$gameplayurl = new moodle_url('/mod/memory3d/js/three/gameplay.js', ['v' => @filemtime(__DIR__ . '/js/three/gameplay.js') ?: time()]);
$dragfillgameplayurl = new moodle_url('/mod/memory3d/js/three/dragfill_gameplay.js', ['v' => @filemtime(__DIR__ . '/js/three/dragfill_gameplay.js') ?: time()]);
$classifierhelpersurl = new moodle_url('/mod/memory3d/js/three/classifier/helpers.js', ['v' => @filemtime(__DIR__ . '/js/three/classifier/helpers.js') ?: time()]);
$classifieranimationurl = new moodle_url('/mod/memory3d/js/three/classifier/animation.js', ['v' => @filemtime(__DIR__ . '/js/three/classifier/animation.js') ?: time()]);
$classifiergameplayurl = new moodle_url('/mod/memory3d/js/three/classifier_gameplay.js', ['v' => @filemtime(__DIR__ . '/js/three/classifier_gameplay.js') ?: time()]);
$intruderhelpersurl = new moodle_url('/mod/memory3d/js/three/intruder/helpers.js', ['v' => @filemtime(__DIR__ . '/js/three/intruder/helpers.js') ?: time()]);
$intruderanimationurl = new moodle_url('/mod/memory3d/js/three/intruder/animation.js', ['v' => @filemtime(__DIR__ . '/js/three/intruder/animation.js') ?: time()]);
$intrudergameplayurl = new moodle_url('/mod/memory3d/js/three/intruder_gameplay.js', ['v' => @filemtime(__DIR__ . '/js/three/intruder_gameplay.js') ?: time()]);
$gameurl = new moodle_url('/mod/memory3d/js/game.js', ['v' => @filemtime(__DIR__ . '/js/game.js') ?: time()]);
$assetbaseurl = new moodle_url('/mod/memory3d/js/');

echo html_writer::script('window.Memory3DAssetBase = ' . json_encode((string)$assetbaseurl) . ';');

echo html_writer::script('', $threeurl);
echo html_writer::script('', $loaderurl);
echo html_writer::script('', $cardsurl);
echo html_writer::script('', $sceneurl);
echo html_writer::script('', $gameplayurl);
echo html_writer::script('', $dragfillgameplayurl);
echo html_writer::script('', $classifierhelpersurl);
echo html_writer::script('', $classifieranimationurl);
echo html_writer::script('', $classifiergameplayurl);
echo html_writer::script('', $intruderhelpersurl);
echo html_writer::script('', $intruderanimationurl);
echo html_writer::script('', $intrudergameplayurl);
echo html_writer::script('', $gameurl);

if (!empty($memory3d->lastaierror) && has_capability('moodle/course:manageactivities', $context)) {
    echo $OUTPUT->notification(format_string($memory3d->lastaierror), 'notifyproblem');
}

if (empty($pairs)) {
    echo $OUTPUT->notification(get_string('nopairsavailable', 'memory3d'), 'warning');
}

if (has_capability('moodle/course:managegrades', $context) || has_capability('moodle/course:manageactivities', $context)) {
    $gradepolicy = \mod_memory3d\services\pairs_manager::normalize_grade_policy((string)($memory3d->gradepolicy ?? 'best'));
    $gradepolicylabel = get_string('gradepolicy' . $gradepolicy, 'memory3d');
    $attemptsql = "SELECT a.id, a.userid, a.gamemode, a.rawscore, a.maxscore, a.finalgrade, a.timemodified,
                          u.firstname, u.lastname
                     FROM {memory3d_attempts} a
                     JOIN {user} u ON u.id = a.userid
                    WHERE a.memory3did = :memory3did
                 ORDER BY a.timemodified DESC, a.id DESC";
    $attemptrecords = $DB->get_records_sql($attemptsql, ['memory3did' => (int)$memory3d->id], 0, 200);

    echo html_writer::tag('h3', get_string('attemptreporttitle', 'memory3d'));
    echo html_writer::tag(
        'p',
        get_string('attemptreportpolicy', 'memory3d', $gradepolicylabel)
    );

    if (empty($attemptrecords)) {
        echo $OUTPUT->notification(get_string('attemptreportempty', 'memory3d'), 'notifymessage');
    } else {
        $table = new html_table();
        $table->head = [
            get_string('attemptreportstudent', 'memory3d'),
            get_string('attemptreportmode', 'memory3d'),
            get_string('attemptreportraw', 'memory3d'),
            get_string('attemptreportgrade', 'memory3d'),
            get_string('attemptreporttime', 'memory3d'),
        ];
        $table->data = [];
        foreach ($attemptrecords as $attempt) {
            $student = fullname((object)[
                'firstname' => $attempt->firstname,
                'lastname' => $attempt->lastname,
            ]);
            $table->data[] = [
                format_string($student),
                s((string)$attempt->gamemode),
                format_float((float)$attempt->rawscore, 2) . ' / ' . format_float((float)$attempt->maxscore, 2),
                format_float((float)$attempt->finalgrade, 2),
                userdate((int)$attempt->timemodified),
            ];
        }
        echo html_writer::table($table);
    }
}

echo $OUTPUT->footer();
