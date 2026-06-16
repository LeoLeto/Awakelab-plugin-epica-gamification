<?php
if (!defined('MOODLE_INTERNAL')) {
    die();
}

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_configcheckbox(
        'memory3d/enabled',
        get_string('settingsenabled', 'memory3d'),
        get_string('settingsenabled_desc', 'memory3d'),
        1
    ));

    $settings->add(new admin_setting_configtext(
        'memory3d/microservice_url',
        get_string('settingsmicroserviceurl', 'memory3d'),
        get_string('settingsmicroserviceurl_desc', 'memory3d'),
        'http://127.0.0.1:8000',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configpasswordunmask(
        'memory3d/apikey',
        get_string('settingsapikey', 'memory3d'),
        get_string('settingsapikey_desc', 'memory3d'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'memory3d/model',
        get_string('settingsmodel', 'memory3d'),
        get_string('settingsmodel_desc', 'memory3d'),
        'gpt-4.1-mini',
        PARAM_TEXT
    ));

    $settings->add(new admin_setting_configtext(
        'memory3d/timeoutseconds',
        get_string('settingstimeout', 'memory3d'),
        get_string('settingstimeout_desc', 'memory3d'),
        30,
        PARAM_INT
    ));

    $settings->add(new admin_setting_configtext(
        'memory3d/maxpairs',
        get_string('settingsmaxpairs', 'memory3d'),
        get_string('settingsmaxpairs_desc', 'memory3d'),
        15,
        PARAM_INT
    ));

    $settings->add(new admin_setting_configtext(
        'memory3d/mongo_uri',
        get_string('settingsmongouri', 'memory3d'),
        get_string('settingsmongouri_desc', 'memory3d'),
        '',
        PARAM_RAW_TRIMMED
    ));

    $settings->add(new admin_setting_configtext(
        'memory3d/mongo_db_name',
        get_string('settingsmongodbname', 'memory3d'),
        get_string('settingsmongodbname_desc', 'memory3d'),
        'memory3d',
        PARAM_ALPHANUMEXT
    ));

}
