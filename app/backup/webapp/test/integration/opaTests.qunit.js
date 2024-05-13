sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'backup/test/integration/FirstJourney',
		'backup/test/integration/pages/ApplicationsList',
		'backup/test/integration/pages/ApplicationsObjectPage',
		'backup/test/integration/pages/HDIContainersObjectPage'
    ],
    function(JourneyRunner, opaJourney, ApplicationsList, ApplicationsObjectPage, HDIContainersObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('backup') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheApplicationsList: ApplicationsList,
					onTheApplicationsObjectPage: ApplicationsObjectPage,
					onTheHDIContainersObjectPage: HDIContainersObjectPage
                }
            },
            opaJourney.run
        );
    }
);