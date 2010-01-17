#ifndef WEBKITAPI_H
#define WEBKITAPI_H

#include <qobject.h>
#include <qplaydar.h>
#include <player/playengine.h>
#include <qjson/parser.h>
#include <qjson/serializer.h>
#include <qjson/qobjecthelper.h>

class QWebView;
class QWebFrame;

class WebkitApi : public QObject
{
    Q_OBJECT
public:
    WebkitApi( Playdar::Client * client, Playengine * p, QObject * );

    void setWebView( QWebView *view );

signals:
    void tick(int, int);
    void stateChange(QString);
    void buffering(int);
    void volumeChanged(int);
    // QID, result obj json
    void result(QString, QString);


public slots:

    // player stuff
    void togglePause();
    void setVolume(int);
    void play(QString);
    void stop();
    void log(QString);


    // playdar stuff
    void resolve(const QString &str);


private slots:
    void attachObject();
    void reemitStatusChanged(Playengine::STATUS);
    void onResult(Playdar::q_ptr, Playdar::r_ptr);

private:
    QWebFrame *frame;
    Playdar::Client * pc;
    Playengine * player;
    QJson::Serializer serializer;
};


#endif // WEBKITAPI_H
