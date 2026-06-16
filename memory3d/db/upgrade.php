<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_memory3d_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    if ($oldversion < 2026042100) {
        $table = new xmldb_table('memory3d');

        $fields = [
            new xmldb_field('sourcetext', XMLDB_TYPE_TEXT, null, null, null, null, null, 'introformat'),
            new xmldb_field('requestedpairs', XMLDB_TYPE_INTEGER, '2', null, XMLDB_NOTNULL, null, '6', 'sourcetext'),
            new xmldb_field('pairscount', XMLDB_TYPE_INTEGER, '4', null, XMLDB_NOTNULL, null, '0', 'requestedpairs'),
            new xmldb_field('pairsjson', XMLDB_TYPE_TEXT, null, null, null, null, null, 'pairscount'),
            new xmldb_field('lastaierror', XMLDB_TYPE_TEXT, null, null, null, null, null, 'pairsjson'),
            new xmldb_field('aigeneratedat', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0', 'lastaierror'),
        ];

        foreach ($fields as $field) {
            if (!$dbman->field_exists($table, $field)) {
                $dbman->add_field($table, $field);
            }
        }

        upgrade_mod_savepoint(true, 2026042100, 'memory3d');
    }

    if ($oldversion < 2026042101) {
        $table = new xmldb_table('memory3d');
        $field = new xmldb_field('difficulty', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'medium', 'requestedpairs');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2026042101, 'memory3d');
    }

    if ($oldversion < 2026042400) {
        $table = new xmldb_table('memory3d');
        $field = new xmldb_field('gamemode', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'memory', 'requestedpairs');

        if (!$dbman->field_exists($table, $field)) {
            $dbman->add_field($table, $field);
        }

        upgrade_mod_savepoint(true, 2026042400, 'memory3d');
    }

    if ($oldversion < 2026051400) {
        $table = new xmldb_table('memory3d_attempts');

        if (!$dbman->table_exists($table)) {
            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('memory3did', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('userid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('gamemode', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'memory');
            $table->add_field('rawscore', XMLDB_TYPE_NUMBER, '10,2', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('maxscore', XMLDB_TYPE_NUMBER, '10,2', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('finalgrade', XMLDB_TYPE_NUMBER, '10,5', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');
            $table->add_field('timemodified', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0');

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);

            $table->add_index('memory3did_idx', XMLDB_INDEX_NOTUNIQUE, ['memory3did']);
            $table->add_index('userid_idx', XMLDB_INDEX_NOTUNIQUE, ['userid']);
            $table->add_index('mem_user_idx', XMLDB_INDEX_NOTUNIQUE, ['memory3did', 'userid']);

            $dbman->create_table($table);
        }

        upgrade_mod_savepoint(true, 2026051400, 'memory3d');
    }

    if ($oldversion < 2026051500) {
        $table = new xmldb_table('memory3d');

        $sourceorigin = new xmldb_field('sourceorigin', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'pdftext', 'sourcetext');
        if (!$dbman->field_exists($table, $sourceorigin)) {
            $dbman->add_field($table, $sourceorigin);
        }

        $sourcecmid = new xmldb_field('sourcecmid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0', 'sourceorigin');
        if (!$dbman->field_exists($table, $sourcecmid)) {
            $dbman->add_field($table, $sourcecmid);
        }

        upgrade_mod_savepoint(true, 2026051500, 'memory3d');
    }

    if ($oldversion < 2026051600) {
        $table = new xmldb_table('memory3d');
        $sourceqcategoryid = new xmldb_field('sourceqcategoryid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, '0', 'sourcecmid');
        if (!$dbman->field_exists($table, $sourceqcategoryid)) {
            $dbman->add_field($table, $sourceqcategoryid);
        }

        upgrade_mod_savepoint(true, 2026051600, 'memory3d');
    }

    if ($oldversion < 2026051800) {
        $table = new xmldb_table('memory3d');

        $qbankuseai = new xmldb_field('qbankuseai', XMLDB_TYPE_INTEGER, '1', null, XMLDB_NOTNULL, null, '0', 'sourceqcategoryid');
        if (!$dbman->field_exists($table, $qbankuseai)) {
            $dbman->add_field($table, $qbankuseai);
        }

        $qbankmixmode = new xmldb_field('qbankmixmode', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, 'exact', 'qbankuseai');
        if (!$dbman->field_exists($table, $qbankmixmode)) {
            $dbman->add_field($table, $qbankmixmode);
        }

        $qbankaiextra = new xmldb_field('qbankaiextra', XMLDB_TYPE_INTEGER, '2', null, XMLDB_NOTNULL, null, '0', 'qbankmixmode');
        if (!$dbman->field_exists($table, $qbankaiextra)) {
            $dbman->add_field($table, $qbankaiextra);
        }

        $qbankaipercent = new xmldb_field('qbankaipercent', XMLDB_TYPE_INTEGER, '3', null, XMLDB_NOTNULL, null, '0', 'qbankaiextra');
        if (!$dbman->field_exists($table, $qbankaipercent)) {
            $dbman->add_field($table, $qbankaipercent);
        }

        $gradepolicy = new xmldb_field('gradepolicy', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, 'best', 'difficulty');
        if (!$dbman->field_exists($table, $gradepolicy)) {
            $dbman->add_field($table, $gradepolicy);
        }

        upgrade_mod_savepoint(true, 2026051800, 'memory3d');
    }

    return true;
}
