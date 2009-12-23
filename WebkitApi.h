#ifndef WEBKITAPI_H
#define WEBKITAPI_H

#include <qobject.h>

class QWebView;
class QWebFrame;

class WebkitApi : public QObject
{
    Q_OBJECT
public:
    WebkitApi( QObject *parent );

    void setWebView( QWebView *view );

    void emitTick(qint64, qint64);
    void emitStateChange(QString);
    void emitBufferPercent(int);
    void emitTogglePause();
    void emitVolumeChanged(int);

signals:
    void elapsed(int, int);
    void stateChange(QString);
    void bufferPercent(int);
    void volumeChanged(int);
    void pauseToggled();
    void playRequested(QString);
    void stopRequested();

public slots:
    void togglePause();
    void setVolume(int);
    void play(QString);
    void stop();

private slots:
    void attachObject();

private:
    QWebFrame *frame;
};


#endif // WEBKITAPI_H
