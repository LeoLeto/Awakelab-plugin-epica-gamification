<?php
namespace mod_memory3d\services;

defined('MOODLE_INTERNAL') || die();

class pdf_file_service {
    private const ALLOWED_RESOURCE_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'odp'];

    public static function save_draft_file(\stdClass $memory3d): void {
        if (empty($memory3d->pdf_filemanager)) {
            return;
        }

        $cmid = self::resolve_cmid($memory3d);
        if (!$cmid) {
            return;
        }

        $context = \context_module::instance($cmid, IGNORE_MISSING);
        if (!$context) {
            return;
        }

        file_save_draft_area_files(
            $memory3d->pdf_filemanager,
            $context->id,
            'mod_memory3d',
            'sourcepdf',
            0,
            [
                'subdirs' => 0,
                'maxfiles' => 1,
                'accepted_types' => ['.pdf'],
            ]
        );
    }

    public static function has_pdf_file(\stdClass $memory3d): bool {
        return self::get_stored_file($memory3d) !== null;
    }

    public static function get_stored_file(\stdClass $memory3d): ?\stored_file {
        $cmid = self::resolve_cmid($memory3d);
        if (!$cmid) {
            return null;
        }

        $context = \context_module::instance($cmid, IGNORE_MISSING);
        if (!$context) {
            return null;
        }

        $fs = get_file_storage();
        $files = $fs->get_area_files($context->id, 'mod_memory3d', 'sourcepdf', 0, 'itemid, filepath, filename', false);
        if (empty($files)) {
            return null;
        }

        return reset($files) ?: null;
    }

    public static function get_course_resource_file(int $courseid, int $sourcecmid): ?\stored_file {
        if ($courseid <= 0 || $sourcecmid <= 0) {
            return null;
        }

        $cm = get_coursemodule_from_id('resource', $sourcecmid, $courseid, false, IGNORE_MISSING);
        if (!$cm) {
            return null;
        }

        $context = \context_module::instance((int)$cm->id, IGNORE_MISSING);
        if (!$context) {
            return null;
        }

        $fs = get_file_storage();
        $files = $fs->get_area_files($context->id, 'mod_resource', 'content', 0, 'timemodified DESC, filename ASC', false);
        if (empty($files)) {
            return null;
        }

        foreach ($files as $file) {
            $filename = (string)$file->get_filename();
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            if (in_array($ext, self::ALLOWED_RESOURCE_EXTENSIONS, true)) {
                return $file;
            }
        }

        return null;
    }

    private static function resolve_cmid(\stdClass $memory3d): int {
        if (!empty($memory3d->coursemodule)) {
            return (int)$memory3d->coursemodule;
        }
        if (empty($memory3d->id)) {
            return 0;
        }
        $cm = get_coursemodule_from_instance(
            'memory3d',
            (int)$memory3d->id,
            (int)($memory3d->course ?? 0),
            false,
            IGNORE_MISSING
        );
        if (!$cm) {
            return 0;
        }
        return (int)$cm->id;
    }
}
