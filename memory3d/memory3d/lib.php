<?php
defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/filelib.php');

use mod_memory3d\services\pairs_manager;
use mod_memory3d\services\pdf_file_service;

function memory3d_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return true;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        default:
            return null;
    }
}

function memory3d_add_instance($memory3d) {
    global $DB;

    $now = time();
    $memory3d->timecreated = $now;
    $memory3d->timemodified = $now;

    pairs_manager::prepare_defaults($memory3d);
    $instanceid = $DB->insert_record('memory3d', pairs_manager::build_db_record($memory3d));

    $memory3d->id = $instanceid;
    pdf_file_service::save_draft_file($memory3d);

    if (!empty($memory3d->autogenerate)) {
        pairs_manager::try_generate_pairs($memory3d);
        $DB->update_record('memory3d', pairs_manager::build_db_record($memory3d));
    }

    memory3d_grade_item_update($memory3d);

    return $instanceid;
}

function memory3d_update_instance($memory3d) {
    global $DB;

    $current = $DB->get_record('memory3d', ['id' => $memory3d->instance], '*', MUST_EXIST);

    $memory3d->id = $memory3d->instance;
    $memory3d->timemodified = time();
    pairs_manager::prepare_defaults($memory3d, $current);

    $DB->update_record('memory3d', pairs_manager::build_db_record($memory3d));
    pdf_file_service::save_draft_file($memory3d);

    if (!empty($memory3d->autogenerate)) {
        pairs_manager::try_generate_pairs($memory3d);
        $DB->update_record('memory3d', pairs_manager::build_db_record($memory3d));
    }

    memory3d_grade_item_update($memory3d);

    return true;
}

function memory3d_delete_instance($id) {
    global $DB;

    if (!$memory3d = $DB->get_record('memory3d', ['id' => $id])) {
        return false;
    }

    memory3d_grade_item_delete($memory3d);
    $DB->delete_records('memory3d_attempts', ['memory3did' => $memory3d->id]);
    $DB->delete_records('memory3d', ['id' => $memory3d->id]);
    return true;
}

function memory3d_get_coursemodule_info($coursemodule) {
    global $DB;

    if (!$memory3d = $DB->get_record('memory3d', ['id' => $coursemodule->instance], 'id, name, intro, introformat')) {
        return null;
    }

    $result = new cached_cm_info();
    $result->name = $memory3d->name;
    if ($coursemodule->showdescription) {
        $result->content = format_module_intro('memory3d', $memory3d, $coursemodule->id, false);
    }

    return $result;
}

function memory3d_grade_item_update($memory3d, $grades = null) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    $params = [
        'itemname' => clean_param($memory3d->name ?? '', PARAM_NOTAGS),
        'gradetype' => GRADE_TYPE_VALUE,
        'grademax' => 100,
        'grademin' => 0,
    ];

    if ($grades === 'reset') {
        $params['reset'] = true;
        $grades = null;
    }

    return grade_update(
        'mod/memory3d',
        (int)$memory3d->course,
        'mod',
        'memory3d',
        (int)$memory3d->id,
        0,
        $grades,
        $params
    );
}

function memory3d_grade_item_delete($memory3d) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    return grade_update(
        'mod/memory3d',
        (int)$memory3d->course,
        'mod',
        'memory3d',
        (int)$memory3d->id,
        0,
        null,
        ['deleted' => 1]
    );
}

function memory3d_update_user_grade($memory3d, int $userid): void {
    global $DB;

    $policy = \mod_memory3d\services\pairs_manager::normalize_grade_policy((string)($memory3d->gradepolicy ?? 'best'));
    $gradevalue = 0.0;

    if ($policy === 'last') {
        $attempts = $DB->get_records(
            'memory3d_attempts',
            [
                'memory3did' => (int)$memory3d->id,
                'userid' => $userid,
            ],
            'timemodified DESC, id DESC',
            'id, finalgrade',
            0,
            1
        );
        $last = reset($attempts);
        $gradevalue = $last ? (float)$last->finalgrade : 0.0;
    } else if ($policy === 'average') {
        $sql = "SELECT AVG(finalgrade)
                  FROM {memory3d_attempts}
                 WHERE memory3did = :memory3did
                   AND userid = :userid";
        $avg = $DB->get_field_sql($sql, [
            'memory3did' => (int)$memory3d->id,
            'userid' => $userid,
        ]);
        $gradevalue = ($avg !== false && $avg !== null) ? (float)$avg : 0.0;
    } else {
        $attempts = $DB->get_records(
            'memory3d_attempts',
            [
                'memory3did' => (int)$memory3d->id,
                'userid' => $userid,
            ],
            'finalgrade DESC, timemodified DESC',
            'id, finalgrade',
            0,
            1
        );
        $best = reset($attempts);
        $gradevalue = $best ? (float)$best->finalgrade : 0.0;
    }

    $grade = new stdClass();
    $grade->userid = $userid;
    $grade->rawgrade = max(0.0, min(100.0, $gradevalue));

    memory3d_grade_item_update($memory3d, $grade);
}

function memory3d_update_user_best_grade($memory3d, int $userid): void {
    // Backward compatibility for old calls.
    memory3d_update_user_grade($memory3d, $userid);
}
