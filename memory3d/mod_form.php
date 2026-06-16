<?php
defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

class mod_memory3d_mod_form extends moodleform_mod {
    private function get_pdf_filemanager_options(): array {
        return [
            'subdirs' => 0,
            'maxbytes' => 0,
            'maxfiles' => 1,
            'accepted_types' => ['.pdf'],
        ];
    }

    private function get_course_resource_options(int $courseid): array {
        $options = [0 => get_string('sourceresourcenone', 'memory3d')];
        if ($courseid <= 0) {
            return $options;
        }

        $modinfo = get_fast_modinfo($courseid);
        if (empty($modinfo->instances['resource'])) {
            return $options;
        }

        foreach ($modinfo->instances['resource'] as $cm) {
            if (empty($cm->uservisible)) {
                continue;
            }
            $name = trim((string)($cm->name ?? ''));
            if ($name === '') {
                $name = get_string('sourceresourcefallback', 'memory3d', $cm->id);
            }
            $options[$cm->id] = format_string($name);
        }

        return $options;
    }

    public function definition() {
        $mform = $this->_form;
        $config = get_config('memory3d');
        $maxpairs = max(2, min(15, (int)($config->maxpairs ?? 15)));

        $mform->addElement('header', 'general', get_string('memory3dfieldset', 'memory3d'));

        $mform->addElement('text', 'name', get_string('memory3dname', 'memory3d'), ['size' => 64]);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');

        $courseid = 0;
        if (!empty($this->current->course)) {
            $courseid = (int)$this->current->course;
        } else if (!empty($this->_course->id)) {
            $courseid = (int)$this->_course->id;
        }

        $sourcechoices = [
            '' => get_string('sourceoriginnone', 'memory3d'),
            'pdftext' => get_string('sourceoriginpdftext', 'memory3d'),
            'resource' => get_string('sourceoriginresource', 'memory3d'),
            'qbank' => get_string('sourceoriginqbank', 'memory3d'),
        ];
        $mform->addElement('select', 'sourceorigin', get_string('sourceorigin', 'memory3d'), $sourcechoices);
        $mform->setType('sourceorigin', PARAM_ALPHA);
        $mform->setDefault('sourceorigin', '');
        $mform->addHelpButton('sourceorigin', 'sourceorigin', 'memory3d');

        $resourceoptions = $this->get_course_resource_options($courseid);
        $mform->addElement('select', 'sourcecmid', get_string('sourceresourcecmid', 'memory3d'), $resourceoptions);
        $mform->setType('sourcecmid', PARAM_INT);
        $mform->setDefault('sourcecmid', 0);
        $mform->addHelpButton('sourcecmid', 'sourceresourcecmid', 'memory3d');

        $qcategoryoptions = \mod_memory3d\services\question_bank_service::get_category_options($courseid);
        $mform->addElement('select', 'sourceqcategoryid', get_string('sourceqcategoryid', 'memory3d'), $qcategoryoptions);
        $mform->setType('sourceqcategoryid', PARAM_INT);
        $mform->setDefault('sourceqcategoryid', 0);
        $mform->addHelpButton('sourceqcategoryid', 'sourceqcategoryid', 'memory3d');
        $mform->addElement('static', 'sourceqcategorynote', '', get_string('sourceqcategorynote', 'memory3d'));
        $mform->addElement('advcheckbox', 'qbankuseai', get_string('qbankuseai', 'memory3d'));
        $mform->setType('qbankuseai', PARAM_BOOL);
        $mform->setDefault('qbankuseai', 0);
        $mform->addHelpButton('qbankuseai', 'qbankuseai', 'memory3d');

        $mixchoices = [
            'exact' => get_string('qbankmixmodeexact', 'memory3d'),
            'percent' => get_string('qbankmixmodepercent', 'memory3d'),
        ];
        $mform->addElement('select', 'qbankmixmode', get_string('qbankmixmode', 'memory3d'), $mixchoices);
        $mform->setType('qbankmixmode', PARAM_ALPHA);
        $mform->setDefault('qbankmixmode', 'exact');
        $mform->addHelpButton('qbankmixmode', 'qbankmixmode', 'memory3d');

        $extrachoices = [];
        for ($x = 0; $x <= $maxpairs; $x++) {
            $extrachoices[$x] = $x;
        }
        $mform->addElement('select', 'qbankaiextra', get_string('qbankaiextra', 'memory3d'), $extrachoices);
        $mform->setType('qbankaiextra', PARAM_INT);
        $mform->setDefault('qbankaiextra', 0);
        $mform->addHelpButton('qbankaiextra', 'qbankaiextra', 'memory3d');

        $percentchoices = [];
        for ($p = 0; $p <= 90; $p += 5) {
            $percentchoices[$p] = $p . '%';
        }
        $mform->addElement('select', 'qbankaipercent', get_string('qbankaipercent', 'memory3d'), $percentchoices);
        $mform->setType('qbankaipercent', PARAM_INT);
        $mform->setDefault('qbankaipercent', 20);
        $mform->addHelpButton('qbankaipercent', 'qbankaipercent', 'memory3d');

        $mform->addElement('filemanager', 'pdf_filemanager', get_string('sourcepdf', 'memory3d'), null, $this->get_pdf_filemanager_options());
        $mform->addHelpButton('pdf_filemanager', 'sourcepdf', 'memory3d');

        $mform->addElement('textarea', 'sourcetext', get_string('sourcetext', 'memory3d'), 'rows="12" cols="80"');
        $mform->setType('sourcetext', PARAM_RAW_TRIMMED);
        $mform->addHelpButton('sourcetext', 'sourcetext', 'memory3d');
        $mform->hideIf('pdf_filemanager', 'sourceorigin', 'neq', 'pdftext');
        $mform->hideIf('sourcetext', 'sourceorigin', 'eq', '');
        $mform->hideIf('sourcetext', 'sourceorigin', 'eq', 'qbank');
        $mform->hideIf('sourcecmid', 'sourceorigin', 'neq', 'resource');
        $mform->hideIf('sourceqcategoryid', 'sourceorigin', 'neq', 'qbank');
        $mform->hideIf('sourceqcategorynote', 'sourceorigin', 'neq', 'qbank');
        $mform->hideIf('qbankuseai', 'sourceorigin', 'neq', 'qbank');
        $mform->hideIf('qbankmixmode', 'sourceorigin', 'neq', 'qbank');
        $mform->hideIf('qbankmixmode', 'qbankuseai', 'notchecked');
        $mform->hideIf('qbankaiextra', 'sourceorigin', 'neq', 'qbank');
        $mform->hideIf('qbankaiextra', 'qbankuseai', 'notchecked');
        $mform->hideIf('qbankaiextra', 'qbankmixmode', 'eq', 'percent');
        $mform->hideIf('qbankaiextra', 'sourceqcategoryid', 'eq', -1);
        $mform->hideIf('qbankaiextra', 'sourceqcategoryid', 'eq', 0);
        $mform->hideIf('qbankaipercent', 'sourceorigin', 'neq', 'qbank');
        $mform->hideIf('qbankaipercent', 'qbankuseai', 'notchecked');
        $mform->hideIf('qbankaipercent', 'qbankmixmode', 'eq', 'exact');
        $mform->hideIf('qbankaipercent', 'sourceqcategoryid', 'eq', -1);
        $mform->hideIf('qbankaipercent', 'sourceqcategoryid', 'eq', 0);

        $pairchoices = [];
        for ($i = 2; $i <= $maxpairs; $i++) {
            $pairchoices[$i] = $i;
        }

        $mform->addElement('select', 'requestedpairs', get_string('requestedpairs', 'memory3d'), $pairchoices);
        $mform->setType('requestedpairs', PARAM_INT);
        $mform->setDefault('requestedpairs', min(6, $maxpairs));
        $mform->addHelpButton('requestedpairs', 'requestedpairs', 'memory3d');
        $mform->hideIf('requestedpairs', 'sourceorigin', 'eq', 'qbank');
        $mform->hideIf('requestedpairs', 'sourceorigin', 'eq', '');

        $gamemodechoices = [
            'memory' => get_string('gamemodememory', 'memory3d'),
            'dragfill' => get_string('gamemodedragfill', 'memory3d'),
            'classifier' => get_string('gamemodeclassifier', 'memory3d'),
            'intruder' => get_string('gamemodeintruder', 'memory3d'),
        ];
        $mform->addElement('select', 'gamemode', get_string('gamemode', 'memory3d'), $gamemodechoices);
        $mform->setType('gamemode', PARAM_ALPHA);
        $mform->setDefault('gamemode', 'memory');
        $mform->addHelpButton('gamemode', 'gamemode', 'memory3d');
        $mform->addElement(
            'static',
            'gamemodeinfo',
            '',
            html_writer::div(
                html_writer::tag('strong', get_string('gamemodememory', 'memory3d') . ':') . ' ' .
                format_string(get_string('gamemodememory_desc', 'memory3d')) .
                html_writer::empty_tag('br') .
                html_writer::tag('strong', get_string('gamemodedragfill', 'memory3d') . ':') . ' ' .
                format_string(get_string('gamemodedragfill_desc', 'memory3d')) .
                html_writer::empty_tag('br') .
                html_writer::tag('strong', get_string('gamemodeclassifier', 'memory3d') . ':') . ' ' .
                format_string(get_string('gamemodeclassifier_desc', 'memory3d')) .
                html_writer::empty_tag('br') .
                html_writer::tag('strong', get_string('gamemodeintruder', 'memory3d') . ':') . ' ' .
                format_string(get_string('gamemodeintruder_desc', 'memory3d')),
                'memory3d-gamemode-info'
            )
        );

        $difficultychoices = [
            'easy' => get_string('difficultyeasy', 'memory3d'),
            'medium' => get_string('difficultymedium', 'memory3d'),
            'hard' => get_string('difficultyhard', 'memory3d'),
        ];
        $mform->addElement('select', 'difficulty', get_string('difficulty', 'memory3d'), $difficultychoices);
        $mform->setType('difficulty', PARAM_ALPHA);
        $mform->setDefault('difficulty', 'medium');
        $mform->addHelpButton('difficulty', 'difficulty', 'memory3d');

        $gradepolicychoices = [
            'best' => get_string('gradepolicybest', 'memory3d'),
            'last' => get_string('gradepolicylast', 'memory3d'),
            'average' => get_string('gradepolicyaverage', 'memory3d'),
        ];
        $mform->addElement('select', 'gradepolicy', get_string('gradepolicy', 'memory3d'), $gradepolicychoices);
        $mform->setType('gradepolicy', PARAM_ALPHA);
        $mform->setDefault('gradepolicy', 'best');
        $mform->addHelpButton('gradepolicy', 'gradepolicy', 'memory3d');

        $mform->addElement('advcheckbox', 'autogenerate', get_string('autogenerate', 'memory3d'));
        $mform->setType('autogenerate', PARAM_BOOL);

        $isupdate = !empty($this->current->instance);
        $mform->setDefault('autogenerate', $isupdate ? 0 : 1);

        $this->standard_intro_elements();
        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    public function data_preprocessing(&$defaultvalues) {
        if (!empty($this->current->coursemodule)) {
            $context = context_module::instance($this->current->coursemodule);
            $draftitemid = file_get_submitted_draft_itemid('pdf_filemanager');
            file_prepare_draft_area(
                $draftitemid,
                $context->id,
                'mod_memory3d',
                'sourcepdf',
                0,
                $this->get_pdf_filemanager_options()
            );
            $defaultvalues['pdf_filemanager'] = $draftitemid;
        }
    }

    public function validation($data, $files) {
        global $USER;

        $errors = parent::validation($data, $files);

        $gamemode = (string)($data['gamemode'] ?? 'memory');
        if (!in_array($gamemode, ['memory', 'dragfill', 'classifier', 'intruder'], true)) {
            $errors['gamemode'] = get_string('errorgamemode', 'memory3d');
        }

        $difficulty = (string)($data['difficulty'] ?? 'medium');
        if (!in_array($difficulty, ['easy', 'medium', 'hard'], true)) {
            $errors['difficulty'] = get_string('errordifficulty', 'memory3d');
        }

        $sourceorigin = (string)($data['sourceorigin'] ?? '');
        if (!in_array($sourceorigin, ['', 'pdftext', 'resource', 'qbank'], true)) {
            $errors['sourceorigin'] = get_string('errorsourceorigin', 'memory3d');
        }
        if ($sourceorigin === '') {
            $errors['sourceorigin'] = get_string('errorsourceoriginrequired', 'memory3d');
        }

        $gradepolicy = (string)($data['gradepolicy'] ?? 'best');
        if (!in_array($gradepolicy, ['best', 'last', 'average'], true)) {
            $errors['gradepolicy'] = get_string('errorgradepolicy', 'memory3d');
        }
        if ($sourceorigin !== 'qbank' && !empty($data['requestedpairs']) && (int)$data['requestedpairs'] < 2) {
            $errors['requestedpairs'] = get_string('errorminimum', 'memory3d', 2);
        }

        if ($sourceorigin === 'resource') {
            $sourcecmid = (int)($data['sourcecmid'] ?? 0);
            if ($sourcecmid <= 0) {
                $errors['sourcecmid'] = get_string('errorsourcecmidrequired', 'memory3d');
            }
            return $errors;
        }

        if ($sourceorigin === 'qbank') {
            $sourceqcategoryid = (int)($data['sourceqcategoryid'] ?? 0);
            if ($sourceqcategoryid === 0) {
                $errors['sourceqcategoryid'] = get_string('errorsourceqcategoryrequired', 'memory3d');
            }
            $qbankuseai = !empty($data['qbankuseai']);
            $qbankaiextra = (int)($data['qbankaiextra'] ?? 0);
            $qbankmixmode = (string)($data['qbankmixmode'] ?? 'exact');
            $qbankaipercent = (int)($data['qbankaipercent'] ?? 0);
            if (!in_array($qbankmixmode, ['exact', 'percent'], true)) {
                $errors['qbankmixmode'] = get_string('errorqbankmixmode', 'memory3d');
            }
            if ($qbankuseai && $sourceqcategoryid > 0 && $qbankaiextra < 0) {
                $errors['qbankaiextra'] = get_string('errorminimum', 'memory3d', 0);
            }
            if ($qbankuseai && $sourceqcategoryid > 0 && $qbankmixmode === 'percent' && ($qbankaipercent < 0 || $qbankaipercent > 90)) {
                $errors['qbankaipercent'] = get_string('errorqbankaipercent', 'memory3d');
            }
            return $errors;
        }

        $pdfcount = 0;
        if (!empty($data['pdf_filemanager'])) {
            $fs = get_file_storage();
            $usercontext = context_user::instance($USER->id);
            $draftfiles = $fs->get_area_files(
                $usercontext->id,
                'user',
                'draft',
                $data['pdf_filemanager'],
                'id',
                false
            );
            $pdfcount = count($draftfiles);
        }

        if ($pdfcount === 0 && trim((string)($data['sourcetext'] ?? '')) === '') {
            $errors['sourcetext'] = get_string('sourcetextorpdfrequired', 'memory3d');
        }

        return $errors;
    }
}
