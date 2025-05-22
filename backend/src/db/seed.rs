pub async fn seed() -> () {
    let pool = create_pool().await;
    
    let mut rng = rand::rng();

    // 例として 500 件をランダム挿入
    for _ in 0..100 {
        // ランダムな四隅の座標を作るために、左下 (x,y) と幅 w, 高さ h を決定
        let mut nums: Vec<i32> = (-100_00..=100_00).collect();
        nums.shuffle(&mut rng);
        let x: i32 = *nums.choose(&mut rng).unwrap();
        let y: i32 = *nums.choose(&mut rng).unwrap();

        let mut nums: Vec<i32> = (100..=500).collect();
        nums.shuffle(&mut rng);
        let w: i32 = *nums.choose(&mut rng).unwrap();
        let h: i32 = *nums.choose(&mut rng).unwrap();

        // WKT 形式の POLYGON を生成（閉じ Point を最後に繰り返す）
        // (x,y)->(x+w,y)->(x+w,y+h)->(x,y+h)->(x,y)
        let polygon_wkt = format!(
            "POLYGON(({} {}, {} {}, {} {}, {} {}, {} {}))",
            x,     y,
            x + w, y,
            x + w, y + h,
            x,     y + h,
            x,     y
        );

        // ランダム文字列をタイトル／コンテンツに
        let title: String = lipsum(2);
        let contents: String = lipsum(100);

        sqlx::query!(
            r#"
            INSERT INTO cards (title, contents, shape)
            VALUES (?, ?, ST_GeomFromText(?))
            "#,
            title, contents, polygon_wkt
        )
        .execute(&pool)
        .await?;
    }

    // tx.commit().await?;
    println!("Seeded random POLYGON cards.");
}