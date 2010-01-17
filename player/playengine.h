#ifndef PLAYENGINE_H
#define PLAYENGINE_H

#include <QObject>
#include <Phonon/AudioOutput>
#include <Phonon/MediaObject>
#include <Phonon/BackendCapabilities>
#include <QString>
#include <QDebug>
#include <QUrl>

class Playengine : public QObject
{
Q_OBJECT
public:
    enum STATUS { PLAYING, STOPPED, PAUSED, LOADING, ERROR };

    explicit Playengine(QObject *parent = 0);
    STATUS status() const;

signals:

    void volume(int);
    void statusChanged(Playengine::STATUS);
    void buffering(int);
    void tick(int,int);

public slots:
    void togglePause();
    void play(const QUrl & url);
    void stop();
    void setVolume(int v);

private slots:
    void stateChanged(Phonon::State newState, Phonon::State oldState);
    void tickslot(qint64 time);
    void sourceChanged(const Phonon::MediaSource &source);
    void metaStateChanged(Phonon::State newState, Phonon::State oldState);
    void aboutToFinish();
    void bufferPercent(int);
    void volumeChanged(qreal);

private:
    void setupPhonon();
    void setStatus(STATUS s);

    STATUS m_status;

    Phonon::MediaObject *mediaObject;
    Phonon::MediaObject *metaInformationResolver;
    Phonon::AudioOutput *audioOutput;
    Phonon::MediaSource *source;

};

#endif // PLAYENGINE_H
