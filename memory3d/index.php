<?php
require(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT);

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);
require_login($course);

$PAGE->set_url('/mod/memory3d/index.php', ['id' => $id]);
$PAGE->set_title($course->shortname . ': ' . get_string('modulenameplural', 'memory3d'));
$PAGE->set_heading($course->fullname);

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'memory3d'));

$instances = get_all_instances_in_course('memory3d', $course);
if (empty($instances)) {
    echo $OUTPUT->notification(get_string('nomemory3dinstances', 'memory3d'), 'info');
    echo $OUTPUT->footer();
    die();
}

$table = new html_table();
$table->head = [get_string('name'), get_string('pairscount', 'memory3d')];

foreach ($instances as $instance) {
    $url = new moodle_url('/mod/memory3d/view.php', ['id' => $instance->coursemodule]);
    $name = format_string($instance->name, true);
    $table->data[] = [html_writer::link($url, $name), (int)$instance->pairscount];
}

echo html_writer::table($table);
echo $OUTPUT->footer();
