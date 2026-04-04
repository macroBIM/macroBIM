/* plotly_geo.js v000

	plotly_hbeam 	( ocvs, iview, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng ) : h beam 중앙 원점
	plotly_rect		( ocvs, slayer, dOx, dOy, db, dh ) : 사각형 중앙 원점
	

*/

function plotly_rect( ocvs, sview, slayer, dOx, dOy, db, dh ){
	/*
		sview 	: 'front' / 'top' / 'bottom' / 'side
		slayer	: layer name
	*/

	var dp1x, dp1y, dp2x, dp2y;
	
	// 수평
	dp1x = dOx - db / 2  	, dp1y = dOy - dh / 2;
	dp2x = dOx + db / 2		, dp2y = dOy - dh / 2;
	ocvs.addLine( sview, dp1x, dp1y, dp2x, dp2y, slayer );

	// 수직
	dp1x = dOx + db / 2  	, dp1y = dOy - dh / 2;
	dp2x = dOx + db / 2		, dp2y = dOy + dh / 2;
	ocvs.addLine( sview, dp1x, dp1y, dp2x, dp2y, slayer );

	// 수평
	dp1x = dOx + db / 2  	, dp1y = dOy + dh / 2;
	dp2x = dOx - db / 2		, dp2y = dOy + dh / 2;
	ocvs.addLine( sview, dp1x, dp1y, dp2x, dp2y, slayer );

	// 수직
	dp1x = dOx - db / 2  	, dp1y = dOy + dh / 2;
	dp2x = dOx - db / 2		, dp2y = dOy - dh / 2;
	ocvs.addLine( sview, dp1x, dp1y, dp2x, dp2y, slayer );
	
}


function plotly_hbeam( ocvs, iview, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng ){

	/*
		iview Option
		0 : front, 1 : top, 2: bottom, 3 : side
		
		
		alayer[]
		0 : solid layer name, 1 : hidden layer name, 2 : center layer name
	*/

	var dp1x, dp1y, dp2x, dp2y;
	var darcb, darce;

	if( iview == 0 ){

		// top flange
		dp1x = dOx - dbt/2  	, dp1y = dOy + dsech - dttf;
		dp2x = dOx - dbt/2		, dp2y = dOy + dsech;
		ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0] );

		dp1x = dOx - dbt/2  	, dp1y = dOy + dsech;
		dp2x = dOx + dbt/2		, dp2y = dOy + dsech;
		ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);
				
		dp1x = dOx + dbt/2  	, dp1y = dOy + dsech;
		dp2x = dOx + dbt/2		, dp2y = dOy + dsech - dttf;
		ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		if( dradius > 0 ){

			dp1x = dOx + dbt/2				, dp1y = dOy + dsech - dttf;
			dp2x = dOx + dtw/2 + dradius	, dp2y = dOy + dsech - dttf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx + dtw/2 + dradius	, dp1y = dOy + dsech - dttf - dradius;
			darcb = 90					, darce = 180;		
			ocvs.addArc('front', dp1x, dp1y, dradius, darcb, darce, alayer[0]);

			dp1x = dOx + dtw/2 		, dp1y = dOy + dsech - dttf - dradius;
			dp2x = dOx + dtw/2 		, dp2y = dOy + dtbf + dradius;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx + dtw/2 + dradius	, dp1y = dOy + dtbf + dradius;
			darcb = 180					, darce = 270;		
			ocvs.addArc('front', dp1x, dp1y, dradius, darcb, darce, alayer[0]);

			dp1x = dOx + dtw/2 + dradius	, dp1y = dOy + dtbf ;
			dp2x = dOx + dbb/2 					, dp2y = dOy + dtbf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);


			dp1x = dOx - dbb/2 					, dp1y = dOy + dtbf;
			dp2x = dOx - dtw/2 - dradius		, dp2y = dOy + dtbf ;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx - dtw/2 - dradius		, dp1y = dOy + dtbf + dradius;
			darcb = 270					, darce = 360;		
			ocvs.addArc('front', dp1x, dp1y, dradius, darcb, darce, alayer[0]);

			dp1x = dOx - dtw/2 		, dp1y = dOy + dtbf + dradius ;
			dp2x = dOx - dtw/2 		, dp2y = dOy + dsech - dttf - dradius ;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx - dtw/2 - dradius		, dp1y = dOy + dsech - dttf - dradius;
			darcb = 0					, darce = 90;		
			ocvs.addArc('front', dp1x, dp1y, dradius, darcb, darce, alayer[0]);

			dp1x = dOx - dtw/2 - dradius		, dp1y = dOy + dsech - dttf ;
			dp2x = dOx - dbt/2 					, dp2y = dOy + dsech - dttf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);
			
		} else {

			dp1x = dOx + dbt/2					, dp1y = dOy + dsech - dttf;
			dp2x = dOx + dtw/2 				, dp2y = dOy + dsech - dttf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx + dtw/2 		, dp1y = dOy + dsech - dttf ;
			dp2x = dOx + dtw/2 		, dp2y = dOy + dtbf ;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx + dtw/2 			, dp1y = dOy + dtbf ;
			dp2x = dOx + dbb/2 				, dp2y = dOy + dtbf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);


			dp1x = dOx - dbb/2 					, dp1y = dOy + dtbf;
			dp2x = dOx - dtw/2 					, dp2y = dOy + dtbf ;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx - dtw/2 		, dp1y = dOy + dtbf ;
			dp2x = dOx - dtw/2 		, dp2y = dOy + dsech - dttf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx - dtw/2 		, dp1y = dOy + dsech - dttf ;
			dp2x = dOx - dbt/2 					, dp2y = dOy + dsech - dttf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);		

		}

			dp1x = dOx + dbb/2 					, dp1y = dOy + dtbf;
			dp2x = dOx + dbb/2 					, dp2y = dOy ;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);
			
			// 하부 수평
			dp1x = dOx + dbb/2 					, dp1y = dOy ;
			dp2x = dOx - dbb/2 					, dp2y = dOy ;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

			dp1x = dOx - dbb/2 					, dp1y = dOy ;
			dp2x = dOx - dbb/2 					, dp2y = dOy + dtbf;
			ocvs.addLine('front', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		
	} else if( iview == 1 ){		// top

		// 좌측 상부선
		dp1x = dOx - dbt/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx - dbt/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('top', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		// 우측 상부선
		dp1x = dOx + dbt/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx + dbt/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('top', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		// 좌측 복부선
		dp1x = dOx - dtw/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx - dtw/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('top', dp1x, dp1y, dp2x, dp2y, alayer[1]);

		// 우측 복부선
		dp1x = dOx + dtw/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx + dtw/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('top', dp1x, dp1y, dp2x, dp2y, alayer[1]);
		
		// 시작 끝
		dp1x = dOx - dbt/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx + dbt/2			, dp2y = dOy - dleng / 2;
		ocvs.addLine('top', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		dp1x = dOx - dbt/2			, dp1y = dOy + dleng / 2;
		dp2x = dOx + dbt/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('top', dp1x, dp1y, dp2x, dp2y, alayer[0]);
		
		
		if( dradius > 0 ){
			
		}

	} else if( iview == 2 ){		// bottom

		// 좌측 상부선
		dp1x = dOx - dbb/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx - dbb/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('bottom', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		// 우측 상부선
		dp1x = dOx + dbb/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx + dbb/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('bottom', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		// 좌측 복부선
		dp1x = dOx - dtw/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx - dtw/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('bottom', dp1x, dp1y, dp2x, dp2y, alayer[1]);

		// 우측 복부선
		dp1x = dOx + dtw/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx + dtw/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('bottom', dp1x, dp1y, dp2x, dp2y, alayer[1]);
		
		// 시작 끝 
		dp1x = dOx - dbb/2			, dp1y = dOy - dleng / 2;
		dp2x = dOx + dbb/2			, dp2y = dOy - dleng / 2;
		ocvs.addLine('bottom', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		dp1x = dOx - dbb/2			, dp1y = dOy + dleng / 2;
		dp2x = dOx + dbb/2			, dp2y = dOy + dleng / 2;
		ocvs.addLine('bottom', dp1x, dp1y, dp2x, dp2y, alayer[0]);
		
		if( dradius > 0 ){
			
		}
		
	} else if( iview == 3 ){		// side
	
		// 상부선
		dp1x = dOx - dleng / 2			, dp1y = dOy + dsech;
		dp2x = dOx + dleng / 2			, dp2y = dOy + dsech;
		ocvs.addLine('side', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		dp1x = dOx - dleng / 2			, dp1y = dOy + dsech - dttf;
		dp2x = dOx + dleng / 2			, dp2y = dOy + dsech - dttf;
		ocvs.addLine('side', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		// 하부선
		dp1x = dOx - dleng / 2			, dp1y = dOy + dtbf;
		dp2x = dOx + dleng / 2			, dp2y = dOy + dtbf;
		ocvs.addLine('side', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		dp1x = dOx - dleng / 2			, dp1y = dOy ;
		dp2x = dOx + dleng / 2			, dp2y = dOy ;
		ocvs.addLine('side', dp1x, dp1y, dp2x, dp2y, alayer[0]);
		
		// 시작 끝
		dp1x = dOx - dleng / 2			, dp1y = dOy ;
		dp2x = dOx - dleng / 2			, dp2y = dOy + dsech;
		ocvs.addLine('side', dp1x, dp1y, dp2x, dp2y, alayer[0]);

		dp1x = dOx + dleng / 2			, dp1y = dOy ;
		dp2x = dOx + dleng / 2			, dp2y = dOy + dsech;
		ocvs.addLine('side', dp1x, dp1y, dp2x, dp2y, alayer[0]);
		
		
	
	}
		
}
